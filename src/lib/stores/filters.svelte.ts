import type { FilterState } from '../db/types'

export const filters = $state<FilterState>({
  agencies: [],
  categories: [],
  valueMin: null,
  valueMax: null,
  search: '',
  dateRange: [null, null],
})

export function resetFilters(): void {
  filters.agencies = []
  filters.categories = []
  filters.valueMin = null
  filters.valueMax = null
  filters.search = ''
  filters.dateRange = [null, null]
}

export function toggleAgency(agency: string): void {
  const idx = filters.agencies.indexOf(agency)
  if (idx === -1) {
    filters.agencies = [...filters.agencies, agency]
  } else {
    filters.agencies = filters.agencies.filter((a) => a !== agency)
  }
}

export function toggleCategory(category: string): void {
  const idx = filters.categories.indexOf(category)
  if (idx === -1) {
    filters.categories = [...filters.categories, category]
  } else {
    filters.categories = filters.categories.filter((c) => c !== category)
  }
}

export function isFiltersActive(): boolean {
  return (
    filters.agencies.length > 0 ||
    filters.categories.length > 0 ||
    filters.valueMin !== null ||
    filters.valueMax !== null ||
    filters.search !== '' ||
    filters.dateRange[0] !== null ||
    filters.dateRange[1] !== null
  )
}
