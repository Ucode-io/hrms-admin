import { useEffect, useMemo, useRef, useState } from "react";

import { ClipboardList, MoreHorizontal, Plus, X } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../components/ui/dropdown/DropdownItem";
import ExpandableSearchInput from "../../components/form/ExpandableSearchInput";
import { useHeaderBreadcrumbItems } from "../../context/HeaderBreadcrumbContext";
import EmployeesPaginationFooter from "../Employees/List/components/EmployeesPaginationFooter";
import companyStore from "../../store/company.store";
import {
  type Survey,
  useDeleteSurvey,
  useSurveysQuery,
} from "../../api/services/survey.service";
import { useTranslation } from "../../i18n";

const PAGE_SIZE = 20;
const SURVEYS_BREADCRUMBS = [{ label: "Опросники", to: "/surveys" }];

type PaginationItem = number | string;

const buildPaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  if (currentPage <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (currentPage >= totalPages - 2) [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: PaginationItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i], prev = sorted[i - 1];
    if (prev && page - prev > 1) result.push(`ellipsis-${prev}-${page}`);
    result.push(page);
  }
  return result;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "bg-gray-100 text-gray-600" },
  active: { label: "Активный", className: "bg-success-50 text-success-700" },
  archived: { label: "Архив", className: "bg-warning-50 text-warning-700" },
};

const resolveStatus = (survey: Survey) => {
  const raw = Array.isArray(survey.status)
    ? String(survey.status[0] || "")
    : String(survey.status || "");
  return STATUS_LABELS[raw] || STATUS_LABELS.draft;
};

export default function SurveysSettingsPage() {
  const { t } = useTranslation();
  useHeaderBreadcrumbItems(SURVEYS_BREADCRUMBS);
  const navigate = useNavigate();
  const brandColor = companyStore.mainColor || "#2563eb";

  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  const queryParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [currentPage, debouncedSearch]
  );

  const { data, isLoading } = useSurveysQuery({ params: queryParams });
  const deleteMutation = useDeleteSurvey();

  const surveys = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginationItems = useMemo(
    () => buildPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const visibleRangeLabel = useMemo(() => {
    if (totalCount === 0) return isLoading ? "Загрузка..." : "Нет записей";
    const start = (safePage - 1) * PAGE_SIZE + 1;
    const end = Math.min(safePage * PAGE_SIZE, totalCount);
    return `Отображение ${start}–${end} из ${totalCount}`;
  }, [safePage, totalCount, isLoading]);

  const hasActiveSearch = Boolean(debouncedSearch);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openDeleteModal = (survey: Survey) => {
    setSurveyToDelete(survey);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSurveyToDelete(null);
  };

  const confirmDelete = async () => {
    if (!surveyToDelete) return;

    try {
      await deleteMutation.mutateAsync(surveyToDelete.guid);
      toast.success("Опросник удален.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete survey:", error);
      toast.error("Не удалось удалить опросник.");
    }
  };

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <PageMeta title="Опросники | Настройки" description="Список опросников компании" />

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="px-4 lg:px-6 py-2.5"
          style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            gap: "10px", flexWrap: "wrap", backgroundColor: "#fff",
            border: "1px solid #e2e8f0", borderTop: "none",
          }}
        >
          <div className="ml-auto flex items-center gap-2">
            <ExpandableSearchInput
              value={searchValue}
              onChange={(v) => { setSearchValue(v); setCurrentPage(1); }}
              inputId="surveys-search"
              placeholder="Поиск по названию..."
              expandedWidth={360}
              collapsedSize={40}
              brandColor={brandColor}
            />
            <Button
              startIcon={<Plus size={16} />}
              onClick={() => navigate("/surveys/new")}
              className="h-10 rounded-xl px-4"
            >
              Новый
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main card ────────────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-slate-50/60 px-5 py-2.5 text-xs text-gray-500">
          {visibleRangeLabel}
        </div>

        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                  Название
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                  Статус
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                  Действия
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={`surveys-skeleton-${index}`}>
                    <TableCell className="px-4 py-4">
                      <div className="h-4 w-60 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                  </TableRow>
                ))
              ) : surveys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ClipboardList size={36} className="text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">Опросники не найдены</p>
                      <p className="text-xs text-gray-400">
                        {hasActiveSearch ? "Попробуйте изменить запрос" : "Создайте первый опросник"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                surveys.map((survey) => {
                  const status = resolveStatus(survey);

                  return (
                    <TableRow key={survey.guid} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        <button
                          type="button"
                          onClick={() => navigate(`/surveys/${survey.guid}`)}
                          className="text-left font-medium text-gray-800 transition hover:text-brand-500"
                        >
                          {String(survey.title || "Без названия")}
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(survey.guid)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Открыть действия"
                            ref={(el) => {
                              actionButtonRefs.current[survey.guid] = el;
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <Dropdown
                            isOpen={openActionsFor === survey.guid}
                            onClose={() => setOpenActionsFor(null)}
                            className="w-40 p-1"
                            usePortal
                            anchorEl={actionButtonRefs.current[survey.guid]}
                          >
                            <DropdownItem
                              onClick={() => navigate(`/surveys/${survey.guid}`)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              Результаты
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => navigate(`/surveys/${survey.guid}/edit`)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              Изменить
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(survey)}
                              className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                            >
                              Удалить
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
      </div>

      {totalPages > 1 && (
        <EmployeesPaginationFooter
          visibleRangeLabel={visibleRangeLabel}
          paginationItems={paginationItems}
          currentPage={safePage}
          totalPages={totalPages}
          brandColor={brandColor}
          onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          onPageChange={(p) => setCurrentPage(p)}
        />
      )}

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить опросник</h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">Это действие нельзя отменить.</p>
          <p className="text-sm text-gray-700">
            {surveyToDelete
              ? `Вы уверены, что хотите удалить "${String(surveyToDelete.title)}"?`
              : "Вы уверены, что хотите удалить этот опросник?"}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              Отмена
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteMutation.isLoading ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
