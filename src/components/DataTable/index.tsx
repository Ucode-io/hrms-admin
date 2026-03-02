import { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Pagination from "../pagination";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  onPageChange: (page: number) => void;
  onRowClick?: (item: T) => void;
  getRowKey: (item: T) => string;
  emptyMessage?: string;
  skeletonRows?: number;
}

export default function DataTable<T>({
  columns,
  data,
  isLoading = false,
  currentPage,
  totalPages,
  totalCount,
  limit,
  onPageChange,
  onRowClick,
  getRowKey,
  emptyMessage = "Нет данных",
  skeletonRows = 8,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  isHeader
                  className={`px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 whitespace-nowrap ${column.headerClassName || ""}`}
                >
                  {column.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {columns.map((column, colIndex) => (
                    <TableCell key={column.key} className="px-3 py-2.5">
                      <div
                        className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                        style={{ width: colIndex === 0 ? '24px' : colIndex === columns.length - 1 ? '40px' : '80px' }}
                      ></div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow
                  key={getRowKey(item)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={`${onRowClick ? "cursor-pointer" : ""} hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors`}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={`px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90 whitespace-nowrap ${column.className || ""}`}
                    >
                      {column.render
                        ? column.render(item, (currentPage - 1) * limit + index)
                        : (item as any)[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        onPageChange={onPageChange}
      />
    </div>
  );
}
