import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Filter } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import DataTable, { Column } from "../../../components/DataTable";
import { useEmployeesQuery, Employee } from "../../../api/services/employee.service";

const GENDER_MAP: Record<string, string> = {
  male: "Мужчина",
  female: "Женщина",
  MALE: "Мужчина",
  FEMALE: "Женщина",
};

export default function EmployeesList() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 20;

  const queryParams = useMemo(
    () => ({
      limit,
      offset: (currentPage - 1) * limit,
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
    }),
    [currentPage, searchQuery]
  );

  const { data, isLoading } = useEmployeesQuery(queryParams);

  const employees: Employee[] = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return dateStr;
    }
  };

  const columns: Column<Employee>[] = [
    {
      key: "index",
      header: "№",
      className: "w-12 text-gray-500",
      render: (_, index) => (currentPage - 1) * limit + index + 1,
    },
    {
      key: "surname",
      header: "Фамилия",
      render: (emp) => (
        <div className="flex items-center gap-3">
          {emp.foto ? (
            <img
              src={emp.foto}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#B38D80]/20 text-[#B38D80] text-xs font-semibold">
              {emp.surname?.charAt(0)?.toUpperCase() ||
                emp.first_name?.charAt(0)?.toUpperCase() ||
                "?"}
            </div>
          )}
          <span className="font-medium text-gray-800">{emp.surname || "—"}</span>
        </div>
      ),
    },
    {
      key: "first_name",
      header: "Имя",
      render: (emp) => emp.first_name || "—",
    },
    {
      key: "second_name",
      header: "Отчество",
      render: (emp) => emp.second_name || "—",
    },
    {
      key: "birth_date",
      header: "Дата рождения",
      render: (emp) => formatDate(emp.birth_date),
    },
    {
      key: "phone",
      header: "Номер телефона",
      render: (emp) => emp.phone || "—",
    },
    {
      key: "gender",
      header: "Пол",
      render: (emp) => {
        const g = Array.isArray(emp.gender) ? emp.gender[0] : emp.gender;
        return GENDER_MAP[g] || g || "—";
      },
    },
    {
      key: "department",
      header: "Отдел",
      render: (emp) => emp.departments_id_data?.name_ru || "—",
    },
    {
      key: "job_title",
      header: "Должность",
      render: (emp) => emp.job_titles_id_data?.name_ru || "—",
    },
    {
      key: "date_hire",
      header: "Дата найма",
      render: (emp) => formatDate(emp.date_hire),
    },
    {
      key: "status",
      header: "Статус",
      render: (emp) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.status
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
            }`}
        >
          {emp.status ? "Активный" : "Неактивный"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Дата создания",
      render: (emp) => formatDateTime(emp.created_at),
    },
    {
      key: "updated_at",
      header: "Дата обновления",
      render: (emp) => formatDateTime(emp.updated_at),
    },
  ];

  return (
    <>
      <PageMeta title="Сотрудники | NSTEX" description="Список сотрудников" />

      {/* Top Bar */}
      <div className="flex items-center gap-4 mb-6">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Назад
        </button>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Поиск"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80]"
          />
        </div>

        {/* Filter button */}
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer">
          <Filter className="w-4 h-4" />
        </button>

        {/* Add employee */}
        <button
          onClick={() => navigate("/organization/employees/new")}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
          style={{ backgroundColor: "#1D2939" }}
          onMouseEnter={(e) =>
            ((e.target as HTMLButtonElement).style.backgroundColor = "#101828")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLButtonElement).style.backgroundColor = "#1D2939")
          }
        >
          <Plus className="w-4 h-4" />
          Добавить сотрудника
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={employees}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        onPageChange={setCurrentPage}
        onRowClick={(emp) => navigate(`/organization/employees/${emp.guid}`)}
        getRowKey={(emp) => emp.guid}
        emptyMessage="Сотрудники не найдены"
      />
    </>
  );
}
