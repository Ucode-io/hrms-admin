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
  type Location,
  useCreateLocation,
  useDeleteLocation,
  useLocationsQuery,
  useUpdateLocation,
} from "../../../api/services/location.service";
import {
  type Region,
  useRegionsQuery,
} from "../../../api/services/region.service";
import LocationMapPicker from "../../../components/map/LocationMapPicker";
import { DEFAULT_OFFICE_RADIUS_M } from "../../../components/map/shared";

const PAGE_SIZE = 20;

type Option = {
  value: string;
  label: string;
};

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

const resolveRegionTitle = (
  location: Location,
  regionsById: Map<string, Region>
): string => {
  const direct = location.regions_id_data?.title;
  if (direct) return String(direct);

  if (location.regions_id) {
    return String(regionsById.get(location.regions_id)?.title || "—");
  }

  return "—";
};

export default function BranchesSettingsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

  const [locationTitle, setLocationTitle] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [regionId, setRegionId] = useState("");
  const [coordinates, setCoordinates] = useState("");
  const [radius, setRadius] = useState("");

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

  const { data, isLoading } = useLocationsQuery({ params: queryParams });
  const { data: regionsData } = useRegionsQuery({ params: { limit: 1000, offset: 0 } });

  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();
  const deleteMutation = useDeleteLocation();

  const locations = useMemo(() => data?.response || [], [data?.response]);
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const regions = useMemo(() => regionsData?.response || [], [regionsData?.response]);

  const regionsById = useMemo(
    () => new Map(regions.map((region) => [region.guid, region])),
    [regions]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const regionOptions = useMemo<Option[]>(
    () => regions.map((region) => ({ value: region.guid, label: String(region.title || "—") })),
    [regions]
  );

  const selectedRegionOption = useMemo<Option | null>(() => {
    if (!regionId) return null;

    const fromList = regionOptions.find((option) => option.value === regionId);
    if (fromList) return fromList;

    return {
      value: regionId,
      label: String(regionsById.get(regionId)?.title || regionId),
    };
  }, [regionId, regionOptions, regionsById]);

  const openCreateModal = () => {
    setEditingLocation(null);
    setLocationTitle("");
    setLocationAddress("");
    setRegionId("");
    setCoordinates("");
    setRadius("");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (location: Location) => {
    setEditingLocation(location);
    setLocationTitle(String(location.title || ""));
    setLocationAddress(String(location.address || ""));
    setRegionId(location.regions_id || "");
    setCoordinates(String(location.coordinates || ""));
    setRadius(location.radius ? String(location.radius) : "");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingLocation(null);
    setLocationTitle("");
    setLocationAddress("");
    setRegionId("");
    setCoordinates("");
    setRadius("");
  };

  const handleSubmit = async () => {
    const title = locationTitle.trim();
    const address = locationAddress.trim();

    if (!title) {
      toast.error("Название филиала обязательно.");
      return;
    }

    // Регион обязателен: из него филиал получает часы, календарь праздников и
    // язык (ADR-0006). Филиал без региона — филиал без часов.
    if (!regionId) {
      toast.error("Выберите регион.");
      return;
    }

    const payload = {
      title,
      address,
      regions_id: regionId,
      coordinates,
      // Пусто — на фронте подставится DEFAULT_OFFICE_RADIUS_M.
      radius: radius.trim() ? Number(radius) : null,
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
        toast.success("Филиал успешно обновлён.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Филиал успешно создан.");
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save branch:", error);
      toast.error("Не удалось сохранить филиал. Попробуйте еще раз.");
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
      toast.success("Филиал удалён.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete branch:", error);
      toast.error("Не удалось удалить филиал.");
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <PageMeta title="Филиалы | Настройки" description="Список филиалов компании" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Филиалы</h1>
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
                    Регион
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Действия
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`branches-skeleton-${index}`}>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : locations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                      Филиалы не найдены
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
                        {resolveRegionTitle(location, regionsById)}
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
            {editingLocation ? "Изменить филиал" : "Новый филиал"}
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
            <label htmlFor="location-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id="location-title"
              value={locationTitle}
              onChange={(event) => setLocationTitle(event.target.value)}
              placeholder="Введите название филиала"
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

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Точка на карте
            </label>
            <LocationMapPicker
              value={coordinates}
              onChange={({ coordinates: next, address }) => {
                setCoordinates(next);
                if (address) setLocationAddress(address);
              }}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="location-radius" className="mb-1.5 block text-sm font-medium text-gray-700">
              Радиус, м
            </label>
            <input
              id="location-radius"
              type="number"
              min={1}
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              placeholder={`По умолчанию ${DEFAULT_OFFICE_RADIUS_M}`}
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
            <p className="mt-1 text-xs text-gray-500">
              Отметку дальше этого расстояния от точки офиса помечаем предупреждением.
              Точность GPS на телефоне — десятки метров, меньше сотни ставить не стоит.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Регион
            </label>
            <Select
              options={regionOptions}
              value={selectedRegionOption}
              onChange={(option) => setRegionId(option?.value || "")}
              placeholder="Выберите регион"
              isSearchable
              styles={getSearchSelectStyles()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="branch-region-select"
              noOptionsMessage={() => "Ничего не найдено"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Часовой пояс, календарь праздников и язык филиал берёт из региона.
            </p>
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
            <h3 className="text-base font-semibold text-gray-900">Удалить филиал</h3>
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
              : "Вы уверены, что хотите удалить этот филиал?"}
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
