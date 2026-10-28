import type { ReactNode } from 'react'

/**
 * Reference table for the docs pages. From `sm` up it is a regular table; below
 * that each row stacks into a card (key on top, every other cell labelled with
 * its column), so nothing is clipped or pushed off-screen on a phone.
 */
export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="border-border rounded-xl border sm:overflow-x-auto">
      <table className="block w-full text-left text-sm sm:table">
        <thead className="bg-muted/50 hidden sm:table-header-group">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border block divide-y sm:table-row-group">
          {rows.map((row, i) => (
            <tr key={i} className="block px-4 py-3 sm:table-row sm:p-0">
              {row.map((cell, j) =>
                j === 0 ? (
                  <th
                    key={j}
                    scope="row"
                    className="text-foreground block pb-1.5 text-left font-medium break-words sm:table-cell sm:px-4 sm:py-2.5 sm:align-top sm:whitespace-nowrap"
                  >
                    {cell}
                  </th>
                ) : (
                  <td
                    key={j}
                    data-label={head[j]}
                    className="text-foreground/80 block py-0.5 break-words before:text-muted-foreground before:block before:pt-1 before:text-xs before:content-[attr(data-label)] sm:table-cell sm:px-4 sm:py-2.5 sm:align-top sm:before:hidden"
                  >
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
