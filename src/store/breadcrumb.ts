import { useEffect } from 'react'
import { create } from 'zustand'

/** Label of the record a detail page shows (e.g. an employee's name); the app shell appends it to the breadcrumb. */
export const useBreadcrumb = create<{ detail: string | null }>()(() => ({ detail: null }))

export function useDetailCrumb(label: string | undefined) {
  useEffect(() => {
    useBreadcrumb.setState({ detail: label ?? null })
    return () => useBreadcrumb.setState({ detail: null })
  }, [label])
}
