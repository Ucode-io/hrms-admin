import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Download,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import Select, { type StylesConfig } from "react-select";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../components/ui/dropdown/DropdownItem";
import Pagination from "../../../components/pagination";
import {
  type Region,
  useCreateRegion,
  useDeleteRegion,
  useRegionsQuery,
  useUpdateRegion,
} from "../../../api/services/region.service";
import {
  type HolidayPolicy,
  useHolidayPoliciesQuery,
} from "../../../api/services/holidayPolicy.service";
import { useLanguagesQuery } from "../../../api/services/companySettings.service";
import { DEFAULT_TIMEZONE, getTimezoneOptions } from "../../../utils/timezones";

const PAGE_SIZE = 20;

type Option = {
  value: string;
  label: string;
};

const getSearchSelectStyles = <M extends boolean = false>(): StylesConfig<Option, M> => ({
  control: (base, state) => ({
    ...base,
    // Высота свободная, а не фиксированные 36px: мультиселект языков растёт
    // чипами, а одиночные селекты в одну строку выглядят ровно как раньше.
    minHeight: "36px",
    borderColor: state.isFocused ? "var(--color-brand-500)" : "#d1d5db",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused
      ? "0 0 0 3px rgba(var(--company-color-rgb, 70, 95, 255), 0.12)"
      : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-500)" : "#9ca3af",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px", fontSize: "14px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "14px" }),
  indicatorsContainer: (base) => ({ ...base, minHeight: "34px" }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "var(--color-brand-500)"
      : state.isFocused
        ? "#f3f4f6"
        : "white",
    color: state.isSelected ? "white" : "#111827",
    padding: "8px 10px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100000,
    borderRadius: "0.5rem",
    border: "1px solid #e5e7eb",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100000,
  }),
  singleValue: (base) => ({ ...base, fontSize: "14px" }),
  placeholder: (base) => ({ ...base, fontSize: "14px", color: "#9ca3af" }),
});

const resolveHolidayPolicyTitle = (
  region: Region,
  holidayPoliciesById: Map<string, HolidayPolicy>
): string => {
  const direct = region.holiday_policies_id_data?.title;
  if (direct) return direct;

  if (region.holiday_policies_id) {
    return String(holidayPoliciesById.get(region.holiday_policies_id)?.title || "—");
  }

  return "—";
};

export default function RegionsSettingsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [regionToDelete, setRegionToDelete] = useState<Region | null>(null);

  const [regionTitle, setRegionTitle] = useState("");
  const [timezone, setTimezone] = useState("");
  const [languageId, setLanguageId] = useState("");
  // Коды языков (`languages.slug`), а не guid'ы — см. `Region.languages`.
  const [languageCodes, setLanguageCodes] = useState<string[]>([]);
  const [holidayPolicyId, setHolidayPolicyId] = useState("");

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

  const { data, isLoading } = useRegionsQuery({ params: queryParams });
  const { data: languagesData } = useLanguagesQuery();
  const { data: holidayPoliciesData } = useHolidayPoliciesQuery({
    params: { limit: 1000, offset: 0 },
  });

  const createMutation = useCreateRegion();
  const updateMutation = useUpdateRegion();
  const deleteMutation = useDeleteRegion();

  const regions = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const languages = useMemo(() => languagesData || [], [languagesData]);
  const holidayPolicies = useMemo(
    () => holidayPoliciesData?.response || [],
    [holidayPoliciesData?.response]
  );

  const languagesById = useMemo(
    () => new Map(languages.map((item) => [item.guid, item])),
    [languages]
  );
  const holidayPoliciesById = useMemo(
    () => new Map(holidayPolicies.map((item) => [item.guid, item])),
    [holidayPolicies]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const timezoneOptions = useMemo<Option[]>(() => getTimezoneOptions(), []);

  const selectedTimezoneOption = useMemo<Option | null>(() => {
    if (!timezone) return null;

    return (
      timezoneOptions.find((option) => option.value === timezone) || {
        value: timezone,
        label: timezone,
      }
    );
  }, [timezone, timezoneOptions]);

  const languageOptions = useMemo<Option[]>(
    () => languages.map((item) => ({ value: item.guid, label: String(item.title || item.slug) })),
    [languages]
  );

  const selectedLanguageOption = useMemo<Option | null>(() => {
    if (!languageId) return null;

    const fromList = languageOptions.find((option) => option.value === languageId);
    if (fromList) return fromList;

    return {
      value: languageId,
      label: String(languagesById.get(languageId)?.title || languageId),
    };
  }, [languageId, languageOptions, languagesById]);

  const languageCodeOptions = useMemo<Option[]>(
    () =>
      languages.map((item) => ({
        value: String(item.slug),
        label: String(item.title || item.slug),
      })),
    [languages]
  );

  const selectedLanguageCodeOptions = useMemo<Option[]>(
    () =>
      languageCodes.map(
        (code) =>
          languageCodeOptions.find((option) => option.value === code) || {
            value: code,
            label: code,
          }
      ),
    [languageCodes, languageCodeOptions]
  );

  const holidayPolicyOptions = useMemo<Option[]>(
    () => holidayPolicies.map((item) => ({ value: item.guid, label: String(item.title || "—") })),
    [holidayPolicies]
  );

  const selectedHolidayPolicyOption = useMemo<Option | null>(() => {
    if (!holidayPolicyId) return null;

    const fromList = holidayPolicyOptions.find((option) => option.value === holidayPolicyId);
    if (fromList) return fromList;

    return {
      value: holidayPolicyId,
      label: String(holidayPoliciesById.get(holidayPolicyId)?.title || holidayPolicyId),
    };
  }, [holidayPolicyId, holidayPolicyOptions, holidayPoliciesById]);

  const openCreateModal = () => {
    setEditingRegion(null);
    setRegionTitle("");
    setTimezone(DEFAULT_TIMEZONE);
    setLanguageId("");
    setLanguageCodes([]);
    setHolidayPolicyId("");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (region: Region) => {
    setEditingRegion(region);
    setRegionTitle(String(region.title || ""));
    setTimezone(String(region.timezone || DEFAULT_TIMEZONE));
    setLanguageId(region.languages_id || "");
    setLanguageCodes(Array.isArray(region.languages) ? region.languages.map(String) : []);
    setHolidayPolicyId(region.holiday_policies_id || "");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingRegion(null);
    setRegionTitle("");
    setTimezone("");
    setLanguageId("");
    setLanguageCodes([]);
    setHolidayPolicyId("");
  };

  const handleSubmit = async () => {
    const title = regionTitle.trim();

    if (!title) {
      toast.error("Название региона обязательно.");
      return;
    }

    // Часовой пояс — единственное, ради чего регион вообще заводится: по нему
    // идут часы всех его филиалов (ADR-0005).
    if (!timezone) {
      toast.error("Выберите часовой пояс.");
      return;
    }

    const payload = {
      title,
      timezone,
      languages_id: languageId || null,
      languages: languageCodes,
      holiday_policies_id: holidayPolicyId || null,
    };

    try {
      if (editingRegion) {
        await updateMutation.mutateAsync({
          guid: editingRegion.guid,
          data: {
            ...editingRegion,
            ...payload,
          },
        });
        toast.success("Регион успешно обновлён.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Регион успешно создан.");
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save region:", error);
      toast.error("Не удалось сохранить регион. Попробуйте еще раз.");
    }
  };

  const openDeleteModal = (region: Region) => {
    setRegionToDelete(region);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setRegionToDelete(null);
  };

  const confirmDelete = async () => {
    if (!regionToDelete) return;

    try {
      await deleteMutation.mutateAsync(regionToDelete.guid);
      toast.success("Регион удалён.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete region:", error);
      toast.error("Не удалось удалить регион.");
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <PageMeta title="Регионы | Настройки" description="Список регионов компании" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Регионы</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Download size={16} />}
              onClick={() => toast.info("Экспорт будет доступен позже.")}
            >
              Экспорт
            </Button>
            <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
              Новый
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-4">
            <label className="relative block">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Поиск..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          <div className="max-w-full overflow-x-auto border-t border-gray-100">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Название
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Часовой пояс
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Язык
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Политика праздников
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Действия
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`regions-skeleton-${index}`}>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : regions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      Регионы не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  regions.map((region) => (
                    <TableRow key={region.guid} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        {String(region.title || "Без названия")}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        {String(region.timezone || "—")}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        {String(
                          region.languages_id_data?.title ||
                            languagesById.get(region.languages_id || "")?.title ||
                            "—"
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        {resolveHolidayPolicyTitle(region, holidayPoliciesById)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(region.guid)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Открыть действия"
                            ref={(el) => {
                              actionButtonRefs.current[region.guid] = el;
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <Dropdown
                            isOpen={openActionsFor === region.guid}
                            onClose={() => setOpenActionsFor(null)}
                            className="w-40 p-1"
                            usePortal
                            anchorEl={actionButtonRefs.current[region.guid]}
                          >
                            <DropdownItem
                              onClick={() => openEditModal(region)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              Изменить
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(region)}
                              className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                            >
                              Удалить
                            </DropdownItem>
                          </Dropdown>
                        </div>
                      </TableCell>
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
            limit={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isUpsertModalOpen}
        onClose={closeUpsertModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[620px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingRegion ? "Изменить регион" : "Новый регион"}
          </h3>
          <button
            type="button"
            onClick={closeUpsertModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto px-4 py-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="region-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id="region-title"
              value={regionTitle}
              onChange={(event) => setRegionTitle(event.target.value)}
              placeholder="Например, Узбекистан / Ташкент"
              autoFocus
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Часовой пояс
            </label>
            <Select
              options={timezoneOptions}
              value={selectedTimezoneOption}
              onChange={(option) => setTimezone(option?.value || "")}
              placeholder="Выберите часовой пояс"
              isSearchable
              styles={getSearchSelectStyles()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="region-timezone-select"
              noOptionsMessage={() => "Ничего не найдено"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Часы, по которым живут все филиалы региона: график, опоздания и
              праздники считаются по ним.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Язык
            </label>
            <Select
              options={languageOptions}
              value={selectedLanguageOption}
              onChange={(option) => setLanguageId(option?.value || "")}
              placeholder="Выберите язык"
              isSearchable
              isClearable
              styles={getSearchSelectStyles()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="region-language-select"
              noOptionsMessage={() => "Ничего не найдено"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Предположение на случай, когда язык сотрудника неизвестен.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Языки приложения
            </label>
            <Select
              isMulti
              options={languageCodeOptions}
              value={selectedLanguageCodeOptions}
              onChange={(options) =>
                setLanguageCodes((options || []).map((option) => option.value))
              }
              placeholder="Все языки"
              isSearchable
              isClearable
              styles={getSearchSelectStyles<true>()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="region-languages-select"
              noOptionsMessage={() => "Ничего не найдено"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Из них сотрудники региона выбирают язык в приложении. Пусто —
              значит доступны все.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Политика праздников
            </label>
            <Select
              options={holidayPolicyOptions}
              value={selectedHolidayPolicyOption}
              onChange={(option) => setHolidayPolicyId(option?.value || "")}
              placeholder="Выберите политику праздников"
              isSearchable
              isClearable
              styles={getSearchSelectStyles()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="region-holiday-policy-select"
              noOptionsMessage={() => "Ничего не найдено"}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button
            variant="outline"
            onClick={closeUpsertModal}
            className="min-w-[96px] px-3 py-2 text-sm"
          >
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="min-w-[110px] px-3 py-2 text-sm">
            {isSaving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить регион</h3>
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
          <p className="text-sm text-gray-500">
            Филиалы этого региона останутся без часов, календаря и языка.
          </p>
          <p className="text-sm text-gray-700">
            {regionToDelete
              ? `Вы уверены, что хотите удалить "${String(regionToDelete.title)}"?`
              : "Вы уверены, что хотите удалить этот регион?"}
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
