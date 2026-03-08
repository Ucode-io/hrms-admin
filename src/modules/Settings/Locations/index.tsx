import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ChevronLeft,
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
  type Country,
  type Location,
  useCountriesQuery,
  useCreateLocation,
  useDeleteLocation,
  useLocationsQuery,
  useUpdateLocation,
} from "../../../api/services/location.service";

const PAGE_SIZE = 20;

type Option = {
  value: string;
  label: string;
};

const TIMEZONE_OPTIONS: Option[] = [
  { value: "GMT+05:00", label: "(GMT+05:00) Tashkent" },
  { value: "GMT+04:00", label: "(GMT+04:00) Dubai" },
  { value: "GMT+03:00", label: "(GMT+03:00) Moscow" },
  { value: "GMT+00:00", label: "(GMT+00:00) UTC" },
];

const getSearchSelectStyles = (): StylesConfig<Option, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "36px",
    height: "36px",
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
  indicatorsContainer: (base) => ({ ...base, height: "34px" }),
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

const resolveCountryTitle = (
  location: Location,
  countriesById: Map<string, Country>
): string => {
  const direct = location.countries_id_data?.title;
  if (direct) return direct;

  if (location.countries_id) {
    return countriesById.get(location.countries_id)?.title || "—";
  }

  return "—";
};

export default function LocationsSettingsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

  const [locationTitle, setLocationTitle] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [countryId, setCountryId] = useState("");
  const [timezone, setTimezone] = useState("");

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

  const { data, isLoading, isFetching } = useLocationsQuery({ params: queryParams });
  const { data: countriesData } = useCountriesQuery();

  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();
  const deleteMutation = useDeleteLocation();

  const locations = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const countries = countriesData?.response || [];

  const countriesById = useMemo(
    () => new Map(countries.map((country) => [country.guid, country])),
    [countries]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const countryOptions = useMemo<Option[]>(
    () => countries.map((country) => ({ value: country.guid, label: country.title })),
    [countries]
  );

  const selectedCountryOption = useMemo<Option | null>(() => {
    if (!countryId) return null;

    const fromList = countryOptions.find((option) => option.value === countryId);
    if (fromList) return fromList;

    return {
      value: countryId,
      label: countriesById.get(countryId)?.title || countryId,
    };
  }, [countryId, countryOptions, countriesById]);

  const selectedTimezoneOption = useMemo<Option | null>(() => {
    if (!timezone) return null;

    return (
      TIMEZONE_OPTIONS.find((option) => option.value === timezone) || {
        value: timezone,
        label: timezone,
      }
    );
  }, [timezone]);

  const openCreateModal = () => {
    setEditingLocation(null);
    setLocationTitle("");
    setLocationAddress("");
    setCountryId("");
    setTimezone(TIMEZONE_OPTIONS[0]?.value || "GMT+05:00");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (location: Location) => {
    setEditingLocation(location);
    setLocationTitle(String(location.title || ""));
    setLocationAddress(String(location.address || ""));
    setCountryId(location.countries_id || "");
    setTimezone(location.timezone?.[0] || TIMEZONE_OPTIONS[0]?.value || "GMT+05:00");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingLocation(null);
    setLocationTitle("");
    setLocationAddress("");
    setCountryId("");
    setTimezone("");
  };

  const handleSubmit = async () => {
    const title = locationTitle.trim();
    const address = locationAddress.trim();

    if (!title) {
      toast.error("Название локации обязательно.");
      return;
    }

    if (!countryId) {
      toast.error("Выберите страну.");
      return;
    }

    if (!timezone) {
      toast.error("Выберите часовой пояс.");
      return;
    }

    const payload = {
      title,
      address,
      countries_id: countryId,
      timezone: [timezone],
    };

    try {
      if (editingLocation) {
        await updateMutation.mutateAsync({
          guid: editingLocation.guid,
          data: {
            ...editingLocation,
            ...payload,
          },
        });
        toast.success("Локация успешно обновлена.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Локация успешно создана.");
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save location:", error);
      toast.error("Не удалось сохранить локацию. Попробуйте еще раз.");
    }
  };

  const openDeleteModal = (location: Location) => {
    setLocationToDelete(location);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setLocationToDelete(null);
  };

  const confirmDelete = async () => {
    if (!locationToDelete) return;

    try {
      await deleteMutation.mutateAsync(locationToDelete.guid);
      toast.success("Локация удалена.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete location:", error);
      toast.error("Не удалось удалить локацию.");
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <PageMeta title="Локации | Настройки" description="Список локаций компании" />

      <div className="space-y-4">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          Назад
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Локации</h1>
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
                    Адрес
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Страна
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Часовой пояс
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Действия
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`locations-skeleton-${index}`}>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : locations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      Локации не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  locations.map((location) => (
                    <TableRow key={location.guid} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        {String(location.title || "Без названия")}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        {String(location.address || "—")}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        {resolveCountryTitle(location, countriesById)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        {location.timezone?.[0] || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(location.guid)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Открыть действия"
                            ref={(el) => {
                              actionButtonRefs.current[location.guid] = el;
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <Dropdown
                            isOpen={openActionsFor === location.guid}
                            onClose={() => setOpenActionsFor(null)}
                            className="w-40 p-1"
                            usePortal
                            anchorEl={actionButtonRefs.current[location.guid]}
                          >
                            <DropdownItem
                              onClick={() => openEditModal(location)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              Изменить
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(location)}
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
            {editingLocation ? "Изменить локацию" : "Новая локация"}
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

        <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="location-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id="location-title"
              value={locationTitle}
              onChange={(event) => setLocationTitle(event.target.value)}
              placeholder="Введите название локации"
              autoFocus
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="location-address" className="mb-1.5 block text-sm font-medium text-gray-700">
              Адрес
            </label>
            <input
              id="location-address"
              value={locationAddress}
              onChange={(event) => setLocationAddress(event.target.value)}
              placeholder="Введите адрес"
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Страна
            </label>
            <Select
              options={countryOptions}
              value={selectedCountryOption}
              onChange={(option) => setCountryId(option?.value || "")}
              placeholder="Выберите страну"
              isSearchable
              styles={getSearchSelectStyles()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="location-country-select"
              noOptionsMessage={() => "Ничего не найдено"}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Часовой пояс
            </label>
            <Select
              options={TIMEZONE_OPTIONS}
              value={selectedTimezoneOption}
              onChange={(option) => setTimezone(option?.value || "")}
              placeholder="Выберите часовой пояс"
              isSearchable
              styles={getSearchSelectStyles()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="location-timezone-select"
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
            <h3 className="text-base font-semibold text-gray-900">Удалить локацию</h3>
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
            Это действие нельзя отменить.
          </p>
          <p className="text-sm text-gray-700">
            {locationToDelete
              ? `Вы уверены, что хотите удалить "${String(locationToDelete.title)}"?`
              : "Вы уверены, что хотите удалить эту локацию?"}
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
