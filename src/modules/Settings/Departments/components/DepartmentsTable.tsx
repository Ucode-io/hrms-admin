import type { MutableRefObject } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { Dropdown } from "../../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../../components/ui/dropdown/DropdownItem";
import type { Department } from "../../../../api/services/department.service";
import type { FlattenedTreeRow } from "../types";
import { useTranslation } from "../../../../i18n";

interface DepartmentsTableProps {
  isLoading: boolean;
  flattenedRows: FlattenedTreeRow[];
  expandedGuids: string[];
  debouncedSearch: string;
  openActionsFor: string | null;
  actionButtonRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onToggleNode: (guid: string) => void;
  onToggleActionsMenu: (guid: string) => void;
  onCloseActionsMenu: () => void;
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
  getLeaderName: (department: Department) => string;
}

export default function DepartmentsTable({
  isLoading,
  flattenedRows,
  expandedGuids,
  debouncedSearch,
  openActionsFor,
  actionButtonRefs,
  onToggleNode,
  onToggleActionsMenu,
  onCloseActionsMenu,
  onEdit,
  onDelete,
  getLeaderName,
}: DepartmentsTableProps) {
  const { t } = useTranslation();
  return (
    <div className="max-w-full overflow-x-auto border-t border-gray-100">
      <Table>
        <TableHeader className="border-b border-gray-100">
          <TableRow>
            <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
              {t("settings_departments.table.column_title")}
            </TableCell>
            <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
              {t("settings_departments.table.column_leader")}
            </TableCell>
            <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
              {t("settings_departments.table.column_actions")}
            </TableCell>
          </TableRow>
        </TableHeader>

        <TableBody className="divide-y divide-gray-100">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <TableRow key={`departments-skeleton-${index}`}>
                <TableCell className="px-4 py-4">
                  <div className="h-4 w-60 animate-pulse rounded bg-gray-200" />
                </TableCell>
                <TableCell className="px-4 py-4">
                  <div className="h-4 w-52 animate-pulse rounded bg-gray-200" />
                </TableCell>
                <TableCell className="px-4 py-4 text-right">
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                </TableCell>
              </TableRow>
            ))
          ) : flattenedRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="px-4 py-10 text-center text-sm text-gray-500">
                {t("settings_departments.table.empty")}
              </TableCell>
            </TableRow>
          ) : (
            flattenedRows.map((row) => {
              const { department, level, hasChildren } = row;
              const isExpanded = expandedGuids.includes(department.guid);

              return (
                <TableRow key={department.guid} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="px-4 py-3 text-sm text-gray-800">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${level * 26}px` }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => onToggleNode(department.guid)}
                          className="rounded-md p-0.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                          aria-label={isExpanded ? t("settings_departments.table.collapse_aria") : t("settings_departments.table.expand_aria")}
                        >
                          {isExpanded || debouncedSearch ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </button>
                      ) : (
                        <span className="inline-block h-4 w-4" />
                      )}

                      <span>{String(department.title || t("settings_departments.table.untitled"))}</span>
                    </div>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-sm text-gray-700">
                    {getLeaderName(department)}
                  </TableCell>

                  <TableCell className="px-4 py-3">
                    <div className="relative flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => onToggleActionsMenu(department.guid)}
                        className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                        aria-label={t("settings_departments.table.open_actions_aria")}
                        ref={(el) => {
                          actionButtonRefs.current[department.guid] = el;
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      <Dropdown
                        isOpen={openActionsFor === department.guid}
                        onClose={onCloseActionsMenu}
                        className="w-40 p-1"
                        usePortal
                        anchorEl={actionButtonRefs.current[department.guid]}
                      >
                        <DropdownItem
                          onClick={() => onEdit(department)}
                          className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                        >
                          {t("settings_departments.table.edit_action")}
                        </DropdownItem>
                        <DropdownItem
                          onClick={() => onDelete(department)}
                          className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                        >
                          {t("settings_departments.table.delete_action")}
                        </DropdownItem>
                      </Dropdown>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
