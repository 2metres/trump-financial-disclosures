package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	searchURL   = "https://projects.propublica.org/trump-team-financial-disclosures/search/__data.json?x-sveltekit-invalidated=01"
	appointeeURL = "https://projects.propublica.org/trump-team-financial-disclosures/appointees/%s/__data.json?x-sveltekit-invalidated=01"
	concurrency = 10
	delayPerReq = 200 * time.Millisecond
)

type Appointee struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Agency      string `json:"agency"`
	Title       string `json:"title"`
	NetWorthLow string `json:"net_worth_low"`
}

// resolveRow decodes a SvelteKit compact JSON schema+flat array row
func resolveRow(flat []any, schema map[string]any) map[string]any {
	result := make(map[string]any)
	for key, valIdx := range schema {
		if idx, ok := valIdx.(float64); ok && int(idx) < len(flat) {
			result[key] = flat[int(idx)]
		} else {
			result[key] = valIdx
		}
	}
	return result
}

func str(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func fetchJSON(url string) (map[string]any, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	return data, nil
}

func fetchSearchIndex() ([]Appointee, error) {
	data, err := fetchJSON(searchURL)
	if err != nil {
		return nil, fmt.Errorf("fetch search: %w", err)
	}

	nodes := data["nodes"].([]any)
	node := nodes[1].(map[string]any)
	flat := node["data"].([]any)
	schema := flat[0].(map[string]any)

	resultIdx := int(schema["result"].(float64))
	resultList := flat[resultIdx].([]any)

	appointees := make([]Appointee, 0, len(resultList))
	for _, idxVal := range resultList {
		idx := int(idxVal.(float64))
		rowSchema := flat[idx].(map[string]any)
		row := resolveRow(flat, rowSchema)
		appointees = append(appointees, Appointee{
			Name:        str(row["a_txt"]),
			Slug:        str(row["a_slug"]),
			Agency:      str(row["agency_name"]),
			Title:       str(row["title"]),
			NetWorthLow: str(row["net_worth_low"]),
		})
	}
	return appointees, nil
}

func scrapeAppointee(slug, outDir string) (int64, error) {
	outPath := filepath.Join(outDir, slug+".json")

	// Skip if already scraped
	if info, err := os.Stat(outPath); err == nil && info.Size() > 0 {
		return info.Size(), nil
	}

	url := fmt.Sprintf(appointeeURL, slug)
	resp, err := http.Get(url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return 0, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	f, err := os.Create(outPath)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	n, err := io.Copy(f, resp.Body)
	return n, err
}

// Manifest tracks scrape state: each line is "status\tslug\tbytes\ttimestamp"
type Manifest struct {
	path string
	mu   sync.Mutex
	f    *os.File
	done map[string]bool
}

func loadManifest(path string) (*Manifest, error) {
	m := &Manifest{path: path, done: make(map[string]bool)}

	// Read existing entries
	if data, err := os.ReadFile(path); err == nil {
		scanner := bufio.NewScanner(strings.NewReader(string(data)))
		for scanner.Scan() {
			parts := strings.SplitN(scanner.Text(), "\t", 4)
			if len(parts) >= 2 && parts[0] == "OK" {
				m.done[parts[1]] = true
			}
		}
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}
	m.f = f
	return m, nil
}

func (m *Manifest) IsDone(slug string) bool {
	return m.done[slug]
}

func (m *Manifest) Record(status, slug string, bytes int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	fmt.Fprintf(m.f, "%s\t%s\t%d\t%s\n", status, slug, bytes, time.Now().UTC().Format(time.RFC3339))
	if status == "OK" {
		m.done[slug] = true
	}
}

func (m *Manifest) Close() { m.f.Close() }

func main() {
	outDir := "data/raw"
	if len(os.Args) > 1 {
		outDir = os.Args[1]
	}
	os.MkdirAll(outDir, 0755)

	manifest, err := loadManifest(filepath.Join(outDir, "_manifest.tsv"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening manifest: %v\n", err)
		os.Exit(1)
	}
	defer manifest.Close()

	fmt.Printf("Manifest: %d already completed\n", len(manifest.done))
	fmt.Println("Fetching search index...")
	appointees, err := fetchSearchIndex()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Found %d appointees\n", len(appointees))

	// Save the index
	indexBytes, _ := json.MarshalIndent(appointees, "", "  ")
	os.WriteFile(filepath.Join(outDir, "_index.json"), indexBytes, 0644)

	var (
		done    atomic.Int64
		failed  atomic.Int64
		total   = int64(len(appointees))
		skipped atomic.Int64
	)

	// Rate-limited semaphore
	sem := make(chan struct{}, concurrency)
	ticker := time.NewTicker(delayPerReq)
	defer ticker.Stop()

	var wg sync.WaitGroup

	for _, a := range appointees {
		// Skip if already in manifest or on disk
		if manifest.IsDone(a.Slug) {
			skipped.Add(1)
			continue
		}
		outPath := filepath.Join(outDir, a.Slug+".json")
		if info, err := os.Stat(outPath); err == nil && info.Size() > 0 {
			skipped.Add(1)
			manifest.Record("OK", a.Slug, info.Size())
			continue
		}

		<-ticker.C
		sem <- struct{}{}
		wg.Add(1)

		go func(slug string) {
			defer wg.Done()
			defer func() { <-sem }()

			size, err := scrapeAppointee(slug, outDir)
			d := done.Add(1)
			if err != nil {
				failed.Add(1)
				manifest.Record("FAIL", slug, 0)
				fmt.Printf("[%d/%d] FAIL %s: %v\n", d, total, slug, err)
			} else {
				manifest.Record("OK", slug, size)
				if d%50 == 0 || d == total {
					fmt.Printf("[%d/%d] %s (%d bytes)\n", d, total, slug, size)
				}
			}
		}(a.Slug)
	}

	wg.Wait()
	fmt.Printf("\nDone: %d scraped, %d skipped, %d failed out of %d\n",
		done.Load(), skipped.Load(), failed.Load(), total)
}
