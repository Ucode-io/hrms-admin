import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Users,
  Wand2,
  X,
} from "lucide-react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import Spinner from "../../components/ui/Spinner";
import { Modal } from "../../components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import SearchableSelect from "../../components/ui/searchable-select";
import companyStore from "../../store/company.store";
import { useEmployeesQuery } from "../../api/services/employee.service";
import {
  useTd2Config,
  useTd2TeamStats,
  useTd2UserStats,
  useTd2SyncAllUsers,
  useTd2MappingList,
  useTd2AutoMatch,
  useTd2MappingCreate,
  useTd2MappingDelete,
  type Td2TeamStatsUser,
  type Td2AutoMatchResult,
} from "../../api/services/timedoctor.service";
import { translate, useTranslation } from "../../i18n";

// --- date helpers ---------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthRange = (year: number, month: number) => ({
  from_date: toIsoDate(new Date(year, month, 1)),
  to_date: toIsoDate(new Date(year, month + 1, 0)),
});
const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;
const monthName = (index: number) => translate(`months.${MONTH_KEYS[index]}` as never);

const formatHours = (hours: number | null | undefined): string => {
  const value = Number(hours || 0);
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return translate("time_tracking.hours_minutes", { h, m: pad(m) });
};

const productivityColor = (pct: number): string => {
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-rose-600";
};

// --- Drill-down modal -----------------------------------------------------

function UserStatsModal({ user,
  from_date,
  to_date,
  onClose,
}: {
  user: Td2TeamStatsUser;
  from_date: string;
  to_date: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useTd2UserStats({
    td2_user_mapping_id: user.td2_user_mapping_id,
    from_date,
    to_date,
  });

  const daily = data?.daily ?? [];

  const chartOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit" },
      plotOptions: { bar: { columnWidth: "55%", borderRadius: 3 } },
      dataLabels: { enabled: false },
      colors: [companyStore.mainColor],
      xaxis: {
        categories: daily.map((d) => d.work_date.slice(8)),
        title: { text: translate("time_tracking.day_of_month"), style: { fontSize: "11px", fontWeight: 400 } },
      },
      yaxis: { title: { text: translate("time_tracking.hours") }, labels: { formatter: (v) => v.toFixed(0) } },
      tooltip: {
        y: { formatter: (v) => formatHours(v) },
      },
      grid: { borderColor: "#f1f1f4" },
    }),
    [daily]
  );

  const chartSeries = useMemo(
    () => [{ name: translate("time_tracking.worked"), data: daily.map((d) => Number(d.total_hours.toFixed(2))) }],
    [daily]
  );

  return (
    <Modal isOpen onClose={onClose} className="max-w-3xl p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {data?.user_name || user.user_name || t("time_tracking.employee")}
          </h3>
          <p className="text-sm text-gray-500">{data?.user_email || user.td2_email || ""}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label={t("time_tracking.total")} value={formatHours(data?.summary.total_hours)} />
            <SummaryCard
              label={t("time_tracking.productivity")}
              value={`${(data?.summary.productivity_pct ?? 0).toFixed(0)}%`}
            />
            <SummaryCard label={t("time_tracking.days")} value={String(data?.summary.days_tracked ?? 0)} />
            <SummaryCard label={t("time_tracking.records")} value={String(data?.summary.total_worklog_count ?? 0)} />
          </div>

          {daily.length > 0 ? (
            <Chart options={chartOptions} series={chartSeries} type="bar" height={280} />
          ) : (
            <p className="py-10 text-center text-sm text-gray-500">
              {t("time_tracking.no_data_period")}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

// --- Statistics tab -------------------------------------------------------

function StatsTab({
  from_date,
  to_date,
  hasConfig,
}: {
  from_date: string;
  to_date: string;
  hasConfig: boolean;
}) {
  const { t } = useTranslation();
  const teamQuery = useTd2TeamStats({ from_date, to_date }, hasConfig);
  const syncMutation = useTd2SyncAllUsers();
  const [selectedUser, setSelectedUser] = useState<Td2TeamStatsUser | null>(null);

  const users = teamQuery.data?.users ?? [];

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync({ from_date, to_date });
      toast.success(t("time_tracking.synced", { count: result.worklogs_synced }));
      await teamQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("time_tracking.sync_error")
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {teamQuery.data ? t("time_tracking.employees_count", { count: users.length }) : t("time_tracking.subtitle")}
        </p>
        <Button
          onClick={() => void handleSync()}
          disabled={syncMutation.isLoading || !hasConfig}
          startIcon={<RefreshCw className={`h-4 w-4 ${syncMutation.isLoading ? "animate-spin" : ""}`} />}
          className="h-10"
        >
          {syncMutation.isLoading ? t("time_tracking.syncing") : t("time_tracking.sync_month")}
        </Button>
      </div>

      <div className="relative rounded-2xl border border-gray-200 bg-white">
        {teamQuery.isFetching && !teamQuery.isLoading ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end rounded-2xl bg-white/45 p-3">
            <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
              {t("time_tracking.loading")}
            </span>
          </div>
        ) : null}

        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                  {t("time_tracking.employee")}
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                  {t("time_tracking.worked")}
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                  {t("time_tracking.productivity")}
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                  {t("time_tracking.days")}
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {teamQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell className="px-4 py-4">
                      <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="ml-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="ml-auto h-4 w-10 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">
                    {hasConfig
                      ? t("time_tracking.no_data_month")
                      : t("time_tracking.connect_first")}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow
                    key={u.td2_user_mapping_id}
                    onClick={() => setSelectedUser(u)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <TableCell className="px-4 py-3 text-sm font-medium text-gray-800">
                      {u.user_name || u.td2_email || "—"}
                      {u.td2_email ? (
                        <span className="ml-2 text-xs font-normal text-gray-400">{u.td2_email}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm text-gray-800">
                      {formatHours(u.total_hours)}
                    </TableCell>
                    <TableCell
                      className={`px-4 py-3 text-right text-sm font-medium ${productivityColor(u.productivity_pct)}`}
                    >
                      {u.productivity_pct.toFixed(0)}%
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm text-gray-700">
                      {u.days_tracked}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedUser ? (
        <UserStatsModal
          user={selectedUser}
          from_date={from_date}
          to_date={to_date}
          onClose={() => setSelectedUser(null)}
        />
      ) : null}
    </div>
  );
}

// --- Mapping tab ----------------------------------------------------------

function MappingTab({
  configId,
  hasConfig,
}: {
  configId: string | null;
  hasConfig: boolean;
}) {
  const { t } = useTranslation();
  const mappingQuery = useTd2MappingList(configId ?? undefined, hasConfig);
  const autoMatchMutation = useTd2AutoMatch();
  const createMutation = useTd2MappingCreate();
  const deleteMutation = useTd2MappingDelete();

  const [unmatched, setUnmatched] = useState<Td2AutoMatchResult["unmatched"]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const employeesQuery = useEmployeesQuery({ limit: 50, search: employeeSearch });
  const employees = (employeesQuery.data?.response ?? []) as Array<{
    guid: string;
    first_name?: string;
    second_name?: string;
    email?: string | null;
  }>;
  const employeeOptions = employees.map((e) => ({
    value: e.guid,
    label: `${[e.second_name, e.first_name].filter(Boolean).join(" ")}${
      e.email ? ` · ${e.email}` : ""
    }`,
  }));

  const mappings = mappingQuery.data?.list ?? [];

  const handleAutoMatch = async () => {
    try {
      const result = await autoMatchMutation.mutateAsync();
      setUnmatched(result.unmatched ?? []);
      toast.success(
        t("time_tracking.automatch_result", { created: result.created_count, unmatched: result.unmatched_count, skipped: result.skipped_inactive })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("time_tracking.automatch_error"));
    }
  };

  const handleManualCreate = async (td2: Td2AutoMatchResult["unmatched"][number]) => {
    const userBaseId = assignments[td2.td2_user_id];
    if (!configId || !userBaseId) {
      toast.error(t("time_tracking.select_employee"));
      return;
    }
    try {
      await createMutation.mutateAsync({
        td2_config_id: configId,
        user_base_id: userBaseId,
        td2_user_id: td2.td2_user_id,
        td2_email: td2.td2_email ?? undefined,
        td2_user_name: td2.td2_user_name ?? undefined,
      });
      toast.success(t("time_tracking.mapping_created"));
      setUnmatched((prev) => prev.filter((u) => u.td2_user_id !== td2.td2_user_id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("time_tracking.mapping_create_error"));
    }
  };

  const handleDelete = async (guid: string) => {
    try {
      await deleteMutation.mutateAsync(guid);
      toast.success(t("time_tracking.mapping_deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("time_tracking.mapping_delete_error"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {t("time_tracking.mapping_subtitle")}
        </p>
        <Button
          onClick={() => void handleAutoMatch()}
          disabled={autoMatchMutation.isLoading || !hasConfig}
          startIcon={<Wand2 className="h-4 w-4" />}
          className="h-10"
        >
          {autoMatchMutation.isLoading ? t("time_tracking.matching") : t("time_tracking.automatch_email")}
        </Button>
      </div>

      {/* Unmatched (from last auto-match) */}
      {unmatched.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-amber-800">
            {t("time_tracking.unmatched", { count: unmatched.length })}
          </h4>
          <div className="mb-3">
            <input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder={t("time_tracking.search_employee_lists")}
              className="h-10 w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-400"
            />
          </div>
          <div className="space-y-2">
            {unmatched.map((u) => (
              <div
                key={u.td2_user_id}
                className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <span className="font-medium text-gray-800">{u.td2_user_name || "—"}</span>
                  <span className="ml-2 text-gray-400">{u.td2_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-64">
                    <SearchableSelect
                      options={employeeOptions}
                      value={assignments[u.td2_user_id] ?? ""}
                      onChange={(val) =>
                        setAssignments((prev) => ({ ...prev, [u.td2_user_id]: val }))
                      }
                      placeholder={t("time_tracking.select_employee_placeholder")}
                      brandColor={companyStore.mainColor}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void handleManualCreate(u)}
                    disabled={createMutation.isLoading || !assignments[u.td2_user_id]}
                  >
                    {t("time_tracking.link")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Existing mappings */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                  {t("time_tracking.hrms_employee")}
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                  Time Doctor
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                  {t("time_tracking.actions")}
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {mappingQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-10 text-center">
                    <Spinner size="sm" />
                  </TableCell>
                </TableRow>
              ) : mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-12 text-center text-sm text-gray-500">
                    {t("time_tracking.no_mappings")}
                  </TableCell>
                </TableRow>
              ) : (
                mappings.map((m) => (
                  <TableRow key={m.guid} className="transition-colors hover:bg-gray-50">
                    <TableCell className="px-4 py-3 text-sm text-gray-800">
                      {m.user_base_name || "—"}
                      {m.user_base_email ? (
                        <span className="ml-2 text-xs text-gray-400">{m.user_base_email}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-700">
                      {m.td2_user_name || "—"}
                      {m.td2_email ? (
                        <span className="ml-2 text-xs text-gray-400">{m.td2_email}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleDelete(m.guid)}
                          disabled={deleteMutation.isLoading}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          title={t("common.delete")}
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
      </div>
    </div>
  );
}

// --- Page -----------------------------------------------------------------

export default function TimeTrackingModule() {
  const { t } = useTranslation();
  const configQuery = useTd2Config();
  const config = configQuery.data ?? null;
  const hasConfig = Boolean(config);

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [tab, setTab] = useState("stats");

  const { from_date, to_date } = useMemo(
    () => monthRange(cursor.year, cursor.month),
    [cursor]
  );

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const isCurrentMonth =
    cursor.year === now.getFullYear() && cursor.month === now.getMonth();

  return (
    <div className="p-4 sm:p-6">
      <PageMeta title={t("time_tracking.title")} description={t("time_tracking.page_description")} />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{t("time_tracking.title")}</h1>
            <p className="text-sm text-gray-500">
              {t("time_tracking.header_subtitle")}
            </p>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-gray-800">
            {monthName(cursor.month)} {cursor.year}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {configQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="stats">{t("time_tracking.tab_stats")}</TabsTrigger>
            <TabsTrigger value="mapping">{t("time_tracking.tab_mapping")}</TabsTrigger>
          </TabsList>
          <TabsContent value="stats">
            <StatsTab from_date={from_date} to_date={to_date} hasConfig={hasConfig} />
          </TabsContent>
          <TabsContent value="mapping">
            <MappingTab configId={config?.guid ?? null} hasConfig={hasConfig} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
