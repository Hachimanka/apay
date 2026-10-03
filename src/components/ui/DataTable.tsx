import { useState, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Skeleton } from './Misc'

type DataTableProps<T> = {
  data: T[] | undefined
  columns: ColumnDef<T, any>[]
  loading?: boolean
  searchPlaceholder?: string
  toolbar?: ReactNode
  pageSize?: number
  onRowClick?: (row: T) => void
  footer?: ReactNode
  empty?: ReactNode
}

/** Sortable, searchable, paginated table used across APAY. */
export function DataTable<T>({
  data,
  columns,
  loading,
  searchPlaceholder = 'Search…',
  toolbar,
  pageSize = 10,
  onRowClick,
  footer,
  empty,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  const rows = table.getRowModel().rows
  const total = table.getFilteredRowModel().rows.length
  const { pageIndex } = table.getState().pagination

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-line bg-bg py-2 pr-3 pl-9 text-sm text-navy placeholder:text-muted/70 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary-100 focus:outline-none"
          />
        </label>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-xs font-semibold text-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted()
                  const align = (h.column.columnDef.meta as { align?: string } | undefined)?.align
                  return (
                    <th key={h.id} className={cn('px-4 py-3 whitespace-nowrap first:pl-5 last:pr-5', align === 'right' && 'text-right')}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex items-center gap-1 hover:text-primary',
                            align === 'right' && 'flex-row-reverse',
                            sorted && 'text-primary',
                          )}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line">
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-5 py-3">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn('transition-colors hover:bg-primary-50/50', onRowClick && 'cursor-pointer')}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align
                      return (
                        <td
                          key={cell.id}
                          className={cn('px-4 py-3 whitespace-nowrap text-ink first:pl-5 last:pr-5', align === 'right' && 'text-right tabular-nums')}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-muted">
                  {empty ?? 'No records found.'}
                </td>
              </tr>
            )}
          </tbody>
          {footer && <tfoot className="border-t-2 border-line bg-bg font-semibold text-navy">{footer}</tfoot>}
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted">
          <span>
            {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg p-1.5 hover:bg-primary-50 hover:text-primary disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg p-1.5 hover:bg-primary-50 hover:text-primary disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
