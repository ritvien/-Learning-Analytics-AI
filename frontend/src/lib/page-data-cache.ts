"use client"

const pageDataCache = new Map<string, unknown>()

export function getPageDataCache<T>(key: string): T | null {
  return (pageDataCache.get(key) as T | undefined) ?? null
}

export function setPageDataCache<T>(key: string, value: T) {
  pageDataCache.set(key, value)
}
