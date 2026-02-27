import React from 'react';
import { cn } from '@/lib/utils';

interface DenseTableProps {
  columns: {
    label: string;
    key: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    hideOnMobile?: boolean;
  }[];
  rows: Record<string, any>[];
  onRowClick?: (row: Record<string, any>) => void;
  className?: string;
  striped?: boolean;
}

export function DenseTable({
  columns,
  rows,
  onRowClick,
  className,
  striped = true,
}: DenseTableProps) {
  const visibleColumns = columns.filter(col => !col.hideOnMobile);

  return (
    <div className={cn('overflow-x-auto border border-ink-200 rounded-lg', className)}>
      <table className="w-full text-sm">
        {/* Header */}
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50">
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 sm:px-4 py-3 font-semibold text-xs text-ink-600 uppercase tracking-wide',
                  col.align === 'center' && 'text-center',
                  col.align === 'right' && 'text-right'
                )}
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-b border-ink-100 py-2',
                striped && rowIdx % 2 === 1 && 'bg-ink-50',
                onRowClick && 'hover:bg-ink-100 cursor-pointer transition-colors'
              )}
            >
              {visibleColumns.map((col) => (
                <td
                  key={`${rowIdx}-${col.key}`}
                  className={cn(
                    'px-3 sm:px-4 py-2.5 text-ink-700 text-xs sm:text-sm',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right'
                  )}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="text-center py-8 text-ink-500 text-sm">
          No data available
        </div>
      )}
    </div>
  );
}
