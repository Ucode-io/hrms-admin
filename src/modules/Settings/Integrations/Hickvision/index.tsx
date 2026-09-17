import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../../components/ui/tabs";
import Pagination from "../../../../components/pagination";
import { getCompaniesId } from "../../../../api/httpRequest";
import hickvisionService from "../../../../api/services/hickvision.service";
import {
  COMPANY_ID,
  useCreateSettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
} from "../../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../../utils/encodeJsonToUrlParam";
import companyStore from "../../../../store/company.store";

const UNIQUE_USERS_SLUG = "unique_users";
const ATTENDANCE_RECORDS_SLUG = "attendance_records";
const COMPANY_MAC_ADDRESSES_SLUG = "company_mac_addresses";
const PAGE_SIZE = 20;

type HickvisionTab = "settings" | "users" | "records";

type CompanyMacAddressItem = {
  guid: string;
  mac_address?: string | null;
  created_at?: string | null;
  companies_id?: string | null;
};

type UniqueUserItem = {
  guid: string;
  full_name?: string | null;
  hikvision_id?: string | null;
  mac_address?: string | null;
  picture?: string | null;
  created_at?: string | null;
};

type AttendanceRecordItem = {
  guid: string;
  hikvision_id?: string | null;
  companies_id?: string | null;
  picture?: string | null;
  action?: string[] | string | null;
  action_time?: string | null;
  date?: string | null;
  event_time?: string | null;
  source?: string | null;
  map?: string | null;
  user_base_id_data?: {
    first_name?: string | null;
    second_name?: string | null;
    name?: string | null;
  } | null;
};
type SyncRangeDraft = {
  fromDate: Date | null;
  toDate: Date | null;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDate = (value: string): Date | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Пусто = событие записано до появления поля, а тогда источник был только один.
const getSourceLabel = (source: string | null | undefined): string =>
  String(source || "").trim().toLowerCase() === "webapp" ? "Приложение" : "Турникет";

const getActionLabel = (action: string[] | string | null | undefined): string => {
  if (Array.isArray(action) && action.length > 0) return String(action[0] || "—");
  if (typeof action === "string" && action.trim()) return action.trim();
  return "—";
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveEmployeeName = (
  item: AttendanceRecordItem,
  uniqueUser?: UniqueUserItem
): string => {
  const relation = item.user_base_id_data;
  if (relation && typeof relation === "object") {
    const first = typeof relation.first_name === "string" ? relation.first_name : "";
    const second = typeof relation.second_name === "string" ? relation.second_name : "";
    const fullName = [second, first].filter(Boolean).join(" ").trim();
    if (fullName) return fullName;
    if (typeof relation.name === "string" && relation.name.trim()) return relation.name.trim();
  }
  if (typeof uniqueUser?.full_name === "string" && uniqueUser.full_name.trim()) {
    return uniqueUser.full_name.trim();
  }
  return "—";
};

const resolvePictureSrc = (picture: string | null | undefined): string => {
  const value = String(picture || "").trim();
  if (!value) return "";
  if (/^(data:image\/|https?:\/\/|blob:|\/)/i.test(value)) return value;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length > 120) {
    return `data:image/jpeg;base64,${value}`;
  }
  return value;
};

const buildInitials = (name: string | null | undefined): string => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (parts[0]?.charAt(0) || "?")
    .concat(parts[1]?.charAt(0) || "")
    .toUpperCase();
};

export default function HickvisionIntegrationSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [macPage, setMacPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [recordsPage, setRecordsPage] = useState(1);
  const [newMacAddress, setNewMacAddress] = useState("");
  const [deletingGuid, setDeletingGuid] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDraft, setSyncDraft] = useState<SyncRangeDraft>(() => {
    const base = parseIsoDate(toIsoDate(new Date())) || new Date();
    return { fromDate: base, toDate: base };
  });
  const companiesId = getCompaniesId() || companyStore.company?.guid || "";

  const activeTab = useMemo<HickvisionTab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "users" || tab === "records" || tab === "settings") return tab;
    return "settings";
  }, [searchParams]);

  const setActiveTab = (nextTab: string) => {
    const safeTab: HickvisionTab = nextTab === "users" || nextTab === "records" ? nextTab : "settings";
    if (safeTab === "settings") {
      setSearchParams({});
    } else {
      setSearchParams({ tab: safeTab });
    }
  };

  const macQueryParams = useMemo(
    () => ({
      with_relations: true,
      data: encodeJsonToUrlParam({
        limit: PAGE_SIZE,
        offset: (macPage - 1) * PAGE_SIZE,
        ...(companiesId ? { companies_id: companiesId } : {}),
      }),
    }),
    [macPage, companiesId]
  );

  const usersQueryParams = useMemo(
    () => ({
      data: encodeJsonToUrlParam({
        limit: PAGE_SIZE,
        offset: (usersPage - 1) * PAGE_SIZE,
      }),
    }),
    [usersPage]
  );

  // Эндпоинт отдаёт attendance_records новыми вперёд — offset считается от
  // начала, как на остальных вкладках. Раньше здесь была инверсия окна с
  // разворотом строк: она исходила из обратного порядка и уводила свежие
  // события на последнюю страницу.
  const recordsQueryParams = useMemo(
    () => ({
      with_relations: true,
      data: encodeJsonToUrlParam({
        limit: PAGE_SIZE,
        offset: (recordsPage - 1) * PAGE_SIZE,
      }),
    }),
    [recordsPage]
  );

  const macAddressesQuery = useSettingsDirectoryQuery({
    slug: COMPANY_MAC_ADDRESSES_SLUG,
    params: macQueryParams,
    querySettings: {
      enabled: activeTab === "settings",
      keepPreviousData: true,
    },
  });

  const usersQuery = useSettingsDirectoryQuery({
    slug: UNIQUE_USERS_SLUG,
    params: usersQueryParams,
    querySettings: {
      enabled: activeTab === "users",
      keepPreviousData: true,
    },
  });

  const recordsQuery = useSettingsDirectoryQuery({
    slug: ATTENDANCE_RECORDS_SLUG,
    params: recordsQueryParams,
    querySettings: {
      enabled: activeTab === "records",
      keepPreviousData: true,
    },
  });

  const recordsUsersQuery = useSettingsDirectoryQuery({
    slug: UNIQUE_USERS_SLUG,
    params: {
      data: encodeJsonToUrlParam({ limit: 500, offset: 0 }),
    },
    querySettings: {
      enabled: activeTab === "records",
    },
  });

  // Terminals, to resolve which company a unique_users row belongs to: the row
  // carries only the terminal's MAC. Unpaginated on purpose — the settings tab
  // pages through the same table, and a page of 20 would silently drop
  // terminals from the lookup below.
  const recordsMacsQuery = useSettingsDirectoryQuery({
    slug: COMPANY_MAC_ADDRESSES_SLUG,
    params: {
      data: encodeJsonToUrlParam({ limit: 500, offset: 0 }),
    },
    querySettings: {
      enabled: activeTab === "records",
    },
  });

  const createMacMutation = useCreateSettingsDirectoryItem(COMPANY_MAC_ADDRESSES_SLUG);
  const deleteMacMutation = useDeleteSettingsDirectoryItem(COMPANY_MAC_ADDRESSES_SLUG);

  const macRows = (macAddressesQuery.data?.response || []) as CompanyMacAddressItem[];
  const macTotalCount = Number(macAddressesQuery.data?.count || 0);
  const macTotalPages = Math.max(1, Math.ceil(macTotalCount / PAGE_SIZE));

  const users = (usersQuery.data?.response || []) as UniqueUserItem[];
  const usersTotalCount = Number(usersQuery.data?.count || 0);
  const usersTotalPages = Math.max(1, Math.ceil(usersTotalCount / PAGE_SIZE));

  const records = (recordsQuery.data?.response || []) as AttendanceRecordItem[];
  const recordsTotalCount = Number(recordsQuery.data?.count || 0);
  const recordsTotalPages = Math.max(1, Math.ceil(recordsTotalCount / PAGE_SIZE));
  // hikvision_id is only unique within one terminal — every device numbers its
  // people from 1 — and this list is not scoped to a company, so keying by the
  // id alone made the last-loaded row win: 367 of the 500 most recent records
  // showed the face of someone from another company. The record's own
  // companies_id plus the terminal's company disambiguate it.
  const recordUserByHikvisionId = useMemo(() => {
    const companyByMac = new Map<string, string>();
    for (const mac of (recordsMacsQuery.data?.response || []) as CompanyMacAddressItem[]) {
      const address = String(mac.mac_address || "").trim();
      if (address && mac.companies_id) companyByMac.set(address, mac.companies_id);
    }

    const map = new Map<string, UniqueUserItem>();
    for (const user of (recordsUsersQuery.data?.response || []) as UniqueUserItem[]) {
      const id = String(user.hikvision_id || "").trim();
      const company = companyByMac.get(String(user.mac_address || "").trim());
      // An unregistered terminal leaves the row unusable: showing no face beats
      // showing a plausible wrong one.
      if (id && company) map.set(`${id}|${company}`, user);
    }
    return map;
  }, [recordsUsersQuery.data?.response, recordsMacsQuery.data?.response]);

  useEffect(() => {
    if (typeof macAddressesQuery.data?.count !== "number") return;
    if (macPage > macTotalPages) setMacPage(macTotalPages);
  }, [macPage, macTotalPages, macAddressesQuery.data?.count]);

  useEffect(() => {
    if (typeof usersQuery.data?.count !== "number") return;
    if (usersPage > usersTotalPages) setUsersPage(usersTotalPages);
  }, [usersPage, usersTotalPages, usersQuery.data?.count]);

  useEffect(() => {
    if (typeof recordsQuery.data?.count !== "number") return;
    if (recordsPage > recordsTotalPages) setRecordsPage(recordsTotalPages);
  }, [recordsPage, recordsTotalPages, recordsQuery.data?.count]);

  const handleAddMacAddress = async () => {
    const macAddress = newMacAddress.trim();
    if (!macAddress) {
      toast.error("Введите MAC address.");
      return;
    }
    if (!companiesId) {
      toast.error("Не найден companies_id компании.");
      return;
    }

    const duplicate = macRows.some(
      (row) => String(row.mac_address || "").trim().toLowerCase() === macAddress.toLowerCase()
    );
    if (duplicate) {
      toast.error("Такой MAC address уже добавлен.");
      return;
    }

    try {
      await createMacMutation.mutateAsync({
        mac_address: macAddress,
        companies_id: companiesId,
      });
      toast.success("MAC address добавлен.");
      setNewMacAddress("");
    } catch (error) {
      console.error("Failed to create company mac address:", error);
      toast.error("Не удалось добавить MAC address.");
    }
  };

  const handleDeleteMacAddress = async (guid: string) => {
    try {
      setDeletingGuid(guid);
      await deleteMacMutation.mutateAsync(guid);
      toast.success("MAC address удален.");
    } catch (error) {
      console.error("Failed to delete company mac address:", error);
      toast.error("Не удалось удалить MAC address.");
    } finally {
      setDeletingGuid(null);
    }
  };

  const openSyncModal = () => {
    const base = new Date();
    setSyncDraft({ fromDate: base, toDate: base });
    setSyncError("");
    setIsSyncModalOpen(true);
  };

  const closeSyncModal = () => {
    if (isSyncing) return;
    setIsSyncModalOpen(false);
    setSyncError("");
  };

  const handleSyncAttendance = async () => {
    if (!syncDraft.fromDate || !syncDraft.toDate) {
      setSyncError("Укажите диапазон дат.");
      return;
    }

    const fromDate = toIsoDate(syncDraft.fromDate);
    const toDate = toIsoDate(syncDraft.toDate);

    if (fromDate > toDate) {
      setSyncError("Дата начала не может быть позже даты окончания.");
      return;
    }

    try {
      setIsSyncing(true);
      setSyncError("");
      setSyncNotice("");

      const response = await hickvisionService.syncAttendanceByDateRange({
        from_date: fromDate,
        to_date: toDate,
        companies_id: companiesId || COMPANY_ID,
      });

      const summary = response.result.summary;
      const processedCount = summary.total_events ?? summary.total_pairs ?? 0;
      const skippedCount =
        (summary.skipped_manual_accepted ?? 0) +
        (summary.skipped_attendance_exists ?? 0) +
        (summary.skipped_non_working_day ?? 0) +
        (summary.skipped_remote_work_schedule ?? 0) +
        (summary.skipped_no_company_membership ?? 0) +
        (summary.no_event ?? 0);
      setSyncNotice(
        `Синхронизация завершена: обработано ${processedCount}, добавлено ${summary.inserted_integration}, обновлено ${summary.updated_integration}, пропущено ${skippedCount}.`
      );

      setIsSyncModalOpen(false);
      await recordsQuery.refetch();
      toast.success("Синхронизация завершена.");
    } catch (error) {
      console.error("Attendance sync error:", error);
      setSyncError("Не удалось выполнить синхронизацию. Попробуйте ещё раз.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <PageMeta title="Hickvision | Настройки" description="Интеграция Hickvision" />

      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Hickvision</h1>
          <p className="mt-1 text-base font-medium text-gray-500">Интеграция с системой контроля доступа</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="settings">
          <TabsList className="mb-3">
            <TabsTrigger value="settings">Настройки</TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
            <TabsTrigger value="records">Записи</TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <div className="relative rounded-2xl border border-gray-200 bg-white">
              {macAddressesQuery.isFetching && !macAddressesQuery.isLoading ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end rounded-2xl bg-white/45 p-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-600 shadow-sm">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
                    Загрузка...
                  </div>
                </div>
              ) : null}

              <div className="border-b border-gray-100 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newMacAddress}
                    onChange={(event) => setNewMacAddress(event.target.value)}
                    placeholder="MAC address (например 44:a6:42:df:ba:42)"
                    className="h-11 min-w-[280px] flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-brand-400"
                    disabled={createMacMutation.isLoading}
                  />
                  <Button
                    onClick={() => {
                      void handleAddMacAddress();
                    }}
                    disabled={createMacMutation.isLoading || !newMacAddress.trim()}
                    className="h-11"
                  >
                    {createMacMutation.isLoading ? "Добавление..." : "Добавить"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Добавьте один или несколько MAC address для текущей компании.
                </p>
              </div>

              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100">
                    <TableRow>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        MAC address
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Created at
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                        Действия
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100">
                    {macAddressesQuery.isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={`mac-skeleton-${index}`}>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4 text-right">
                            <div className="ml-auto h-8 w-8 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : macRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="px-4 py-10 text-center text-sm text-gray-500">
                          MAC addresses пока не добавлены.
                        </TableCell>
                      </TableRow>
                    ) : (
                      macRows.map((row) => (
                        <TableRow key={row.guid} className="transition-colors hover:bg-gray-50">
                          <TableCell className="px-4 py-3 text-sm text-gray-800">{row.mac_address || "—"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">{formatDateTime(row.created_at)}</TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  void handleDeleteMacAddress(row.guid);
                                }}
                                disabled={deleteMacMutation.isLoading && deletingGuid === row.guid}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Удалить"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {macTotalCount > 0 ? (
                <Pagination
                  currentPage={macPage}
                  totalPages={macTotalPages}
                  totalCount={macTotalCount}
                  limit={PAGE_SIZE}
                  onPageChange={setMacPage}
                />
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="relative rounded-2xl border border-gray-200 bg-white">
              {usersQuery.isFetching && !usersQuery.isLoading ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end rounded-2xl bg-white/45 p-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-600 shadow-sm">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
                    Загрузка...
                  </div>
                </div>
              ) : null}
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100">
                    <TableRow>
                      <TableCell isHeader className="w-20 px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Фото
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Full name
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Hikvision ID
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        MAC address
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Created at
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100">
                    {usersQuery.isLoading ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <TableRow key={`users-skeleton-${index}`}>
                          <TableCell className="px-4 py-4">
                            <div className="h-14 w-14 animate-pulse rounded-lg bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                          Пользователи не найдены.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((item) => (
                        <TableRow key={item.guid} className="transition-colors hover:bg-gray-50">
                          <TableCell className="px-4 py-3">
                            <HickvisionUserPicture
                              picture={item.picture}
                              name={item.full_name}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-800">{item.full_name || "—"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">{item.hikvision_id || "—"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">{item.mac_address || "—"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">{formatDateTime(item.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {usersTotalCount > 0 ? (
                <Pagination
                  currentPage={usersPage}
                  totalPages={usersTotalPages}
                  totalCount={usersTotalCount}
                  limit={PAGE_SIZE}
                  onPageChange={setUsersPage}
                />
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="records">
            <div className="relative rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center justify-end border-b border-gray-100 p-4">
                <button
                  type="button"
                  onClick={openSyncModal}
                  className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Синхронизация
                </button>
              </div>

              {syncNotice ? (
                <div className="mx-4 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                  {syncNotice}
                </div>
              ) : null}

              {recordsQuery.isFetching && !recordsQuery.isLoading ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end rounded-2xl bg-white/45 p-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-600 shadow-sm">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
                    Загрузка...
                  </div>
                </div>
              ) : null}
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100">
                    <TableRow>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Фото
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Employee
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Action
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Date
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Event time
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Action time
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Источник
                      </TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                        Гео
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100">
                    {recordsQuery.isLoading ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <TableRow key={`records-skeleton-${index}`}>
                          <TableCell className="px-4 py-4">
                            <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                          Записи не найдены.
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((item) => {
                        const uniqueUser = recordUserByHikvisionId.get(
                          `${String(item.hikvision_id || "").trim()}|${item.companies_id || ""}`
                        );
                        return (
                        <TableRow key={item.guid} className="transition-colors hover:bg-gray-50">
                          <TableCell className="px-4 py-3">
                            <HickvisionUserPicture
                              picture={item.picture || uniqueUser?.picture}
                              name={resolveEmployeeName(item, uniqueUser)}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-800">
                            {resolveEmployeeName(item, uniqueUser)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">{getActionLabel(item.action)}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">{item.date || "—"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">{item.event_time || "—"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">{item.action_time || "—"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">{getSourceLabel(item.source)}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700">
                            {item.map ? (
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(item.map)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-500 hover:underline"
                              >
                                {item.map}
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {recordsTotalCount > 0 ? (
                <Pagination
                  currentPage={recordsPage}
                  totalPages={recordsTotalPages}
                  totalCount={recordsTotalCount}
                  limit={PAGE_SIZE}
                  onPageChange={setRecordsPage}
                />
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Modal
        isOpen={isSyncModalOpen}
        onClose={closeSyncModal}
        className="max-w-xl w-full p-0 overflow-visible"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <h4 className="m-0 text-[22px] font-bold text-slate-900">
            Синхронизация посещаемости
          </h4>
          <p className="m-0 mt-1 text-[13px] text-slate-500">
            Обновит `attendance` из `attendance_records` за выбранный период.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Дата начала
              </label>
              <DatePicker
                selected={syncDraft.fromDate}
                onChange={(date) =>
                  setSyncDraft((prev) => ({
                    ...prev,
                    fromDate: date,
                  }))
                }
                dateFormat="dd.MM.yyyy"
                placeholderText="дд.мм.гггг"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                wrapperClassName="w-full"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Дата окончания
              </label>
              <DatePicker
                selected={syncDraft.toDate}
                onChange={(date) =>
                  setSyncDraft((prev) => ({
                    ...prev,
                    toDate: date,
                  }))
                }
                dateFormat="dd.MM.yyyy"
                placeholderText="дд.мм.гггг"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                wrapperClassName="w-full"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>
          </div>

          {syncError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
              {syncError}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={closeSyncModal}
            disabled={isSyncing}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSyncAttendance();
            }}
            disabled={isSyncing}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: companyStore.mainColor }}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Синхронизация...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Запустить
              </>
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}

function HickvisionUserPicture({
  picture,
  name,
}: {
  picture?: string | null;
  name?: string | null;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const pictureSrc = resolvePictureSrc(picture);

  if (pictureSrc && !hasImageError) {
    return (
      <img
        src={pictureSrc}
        alt={name || "Hickvision user"}
        className="h-14 w-14 rounded-lg border border-gray-200 bg-gray-50 object-contain"
        loading="lazy"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-[13px] font-semibold text-gray-500">
      {buildInitials(name)}
    </div>
  );
}
