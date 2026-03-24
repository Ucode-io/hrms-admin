import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Search, LayoutGrid, List, Mail, Phone, Linkedin, ChevronLeft, ChevronRight, SlidersHorizontal, Plus } from "lucide-react";
import { observer } from "mobx-react-lite";
import PageMeta from "../../../components/common/PageMeta";
import companyStore from "../../../store/company.store";
import { useEmployeesQuery, type Employee } from "../../../api/services/employee.service";

const PAGE_SIZE = 24;

/* ────────────────────────────────────────────────
 *  Component
 * ──────────────────────────────────────────────── */
function EmployeesList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const brandColor = companyStore.mainColor;

  /* ── API data ── */
  const { data: apiData, isLoading } = useEmployeesQuery({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    search: searchQuery || undefined,
  });

  const employees: Employee[] = useMemo(() => {
    if (!apiData) return [];
    return (apiData.response || []) as Employee[];
  }, [apiData]);

  const totalCount = apiData?.count ?? employees.length;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /* ── helper: build display name ── */
  const getDisplayName = (emp: Employee) =>
    [emp.second_name, emp.first_name].filter(Boolean).join(" ") || "—";

  const getPosition = (emp: Employee) =>
    emp.positions_id_data?.title || "";

  const getDepartment = (emp: Employee) =>
    emp.departments_id_data?.title || "";

  const getLocation = (emp: Employee) =>
    emp.locations_id_data?.title || "";

  const isDismissed = (emp: Employee) => emp.status?.includes("dismissed");

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <>
      <PageMeta title="Сотрудники | HRMS" description="Список сотрудников" />

      {/* ── Top Bar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 400px", maxWidth: "700px" }}>
          <Search
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "18px",
              height: "18px",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          />
          <input
            id="employees-search"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Поиск по имени, электронной почте или номеру телефона"
            style={{
              width: "100%",
              paddingLeft: "42px",
              paddingRight: "16px",
              paddingTop: "10px",
              paddingBottom: "10px",
              fontSize: "14px",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              outline: "none",
              color: "#1e293b",
              backgroundColor: "#fff",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = brandColor)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
          {/* Filter button */}
          <button
            id="employees-filter-btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#1e293b",
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
          >
            <SlidersHorizontal style={{ width: "16px", height: "16px" }} />
            Фильтр
            <span style={{ fontSize: "11px", marginLeft: "2px" }}>▸</span>
          </button>

          {/* View toggle */}
          <div
            style={{
              display: "flex",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <button
              id="employees-view-grid"
              onClick={() => setViewMode("grid")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "38px",
                height: "38px",
                backgroundColor: viewMode === "grid" ? brandColor : "#fff",
                color: viewMode === "grid" ? "#fff" : "#64748b",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <LayoutGrid style={{ width: "18px", height: "18px" }} />
            </button>
            <button
              id="employees-view-list"
              onClick={() => setViewMode("list")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "38px",
                height: "38px",
                backgroundColor: viewMode === "list" ? brandColor : "#fff",
                color: viewMode === "list" ? "#fff" : "#64748b",
                border: "none",
                borderLeft: "1px solid #e2e8f0",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <List style={{ width: "18px", height: "18px" }} />
            </button>
          </div>

          {/* Add button */}
          <button
            id="employees-add-btn"
            onClick={() => navigate("/employees/new")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 18px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              backgroundColor: brandColor,
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Plus style={{ width: "16px", height: "16px" }} />
            Добавить
          </button>
        </div>
      </div>

      {/* ── Info line ── */}
      <div
        style={{
          fontSize: "13px",
          color: "#64748b",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>
          {totalCount > 0
            ? `Отображение ${(currentPage - 1) * PAGE_SIZE + 1} - ${Math.min(currentPage * PAGE_SIZE, totalCount)} из ${totalCount}`
            : "Нет данных"}
        </span>

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            id="employees-page-prev"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              backgroundColor: "#fff",
              color: currentPage === 1 ? "#cbd5e1" : "#1e293b",
              cursor: currentPage === 1 ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            <ChevronLeft style={{ width: "16px", height: "16px" }} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "32px",
                height: "32px",
                padding: "0 8px",
                border: currentPage === page ? `1px solid ${brandColor}` : "1px solid #e2e8f0",
                borderRadius: "8px",
                backgroundColor: currentPage === page ? brandColor : "#fff",
                color: currentPage === page ? "#fff" : "#1e293b",
                fontWeight: currentPage === page ? 600 : 400,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {page}
            </button>
          ))}

          <button
            id="employees-page-next"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              backgroundColor: "#fff",
              color: currentPage === totalPages ? "#cbd5e1" : "#1e293b",
              cursor: currentPage === totalPages ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            <ChevronRight style={{ width: "16px", height: "16px" }} />
          </button>
        </div>
      </div>

      {/* ── Loading state ── */}
      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "3px solid #e2e8f0",
              borderTopColor: brandColor,
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      ) : viewMode === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {employees.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "60px 0",
                color: "#94a3b8",
                fontSize: "15px",
              }}
            >
              Сотрудники не найдены
            </div>
          ) : (
            employees.map((emp) => (
              <EmployeeCard
                key={emp.guid}
                employee={emp}
                brandColor={brandColor}
                name={getDisplayName(emp)}
                position={getPosition(emp)}
                department={getDepartment(emp)}
                location={getLocation(emp)}
                onClick={() => navigate(`/employees/${emp.guid}`)}
              />
            ))
          )}
        </div>
      ) : (
        /* ── Table view ── */
        <div
          style={{
            overflow: "hidden",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#fff",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  {["", "Имя", "Должность", "Отдел", "Локация", "Email", "Телефон"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#64748b",
                          borderBottom: "1px solid #e2e8f0",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "#94a3b8",
                        fontSize: "14px",
                      }}
                    >
                      Сотрудники не найдены
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const name = getDisplayName(emp);
                    const dismissed = isDismissed(emp);
                    return (
                      <tr
                        key={emp.guid}
                        onClick={() => navigate(`/employees/${emp.guid}`)}
                        style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s", cursor: "pointer" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#f8fafc")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "transparent")
                        }
                      >
                        <td style={{ padding: "10px 16px", width: "56px" }}>
                          <Avatar name={name} photo={emp.photo} size={36} />
                        </td>
                        <td
                          style={{
                            padding: "10px 16px",
                            color: "#1e293b",
                            fontSize: "14px",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{name}</span>
                              {dismissed ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 8px",
                                    borderRadius: "999px",
                                    border: "1px solid #fecaca",
                                    backgroundColor: "#fef2f2",
                                    color: "#b91c1c",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                  }}
                                >
                                  Уволен
                                </span>
                              ) : null}
                            </div>
                            {dismissed && emp.dismissal_date ? (
                              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                                Дата увольнения: {formatDate(emp.dismissal_date)}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                          {getPosition(emp) || "—"}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                          {getDepartment(emp) || "—"}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                          {getLocation(emp) || "—"}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                          {emp.email || "—"}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                          {emp.phone || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default observer(EmployeesList);

/* ────────────────────────────────────────────────
 *  Sub-components
 * ──────────────────────────────────────────────── */

function Avatar({
  name,
  photo,
  size = 44,
}: {
  name: string;
  photo: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          minHeight: `${size}px`,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: "50%",
        backgroundColor: "#dbeafe",
        color: "#3b82f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${Math.round(size * 0.35)}px`,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function ContactIcon({
  icon,
  href,
  title,
}: {
  icon: React.ReactNode;
  href?: string;
  title: string;
}) {
  const Wrapper = href ? "a" : "span";
  return (
    <Wrapper
      {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "28px",
        height: "28px",
        borderRadius: "6px",
        color: "#475569",
        cursor: href ? "pointer" : "default",
        transition: "color 0.15s",
      }}
      onMouseEnter={(e: any) => (e.currentTarget.style.color = "#1e293b")}
      onMouseLeave={(e: any) => (e.currentTarget.style.color = "#475569")}
    >
      {icon}
    </Wrapper>
  );
}

function EmployeeCard({
  employee,
  brandColor,
  name,
  position,
  department,
  location,
  onClick,
}: {
  employee: Employee;
  brandColor: string;
  name: string;
  position: string;
  department: string;
  location: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const positionLabel = [position, department, location ? `в ${location}` : ""]
    .filter(Boolean)
    .join(" · ");
  const isDismissed = employee.status?.includes("dismissed");
  const dismissalDateLabel =
    employee.dismissal_date && !Number.isNaN(new Date(employee.dismissal_date).getTime())
      ? new Date(employee.dismissal_date).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : employee.dismissal_date || "";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "20px",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        backgroundColor: "#fff",
        transition: "box-shadow 0.2s, border-color 0.2s",
        boxShadow: hovered
          ? "0 4px 12px rgba(0,0,0,0.06)"
          : "0 1px 3px rgba(0,0,0,0.02)",
        borderColor: hovered ? "#cbd5e1" : "#e2e8f0",
        cursor: "pointer",
      }}
    >
      {/* Top section: avatar + info */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <Avatar name={name} photo={employee.photo} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "15px",
                color: "#1e293b",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {name}
            </div>
            {isDismissed ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  border: "1px solid #fecaca",
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                Уволен
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#64748b",
              marginTop: "2px",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {positionLabel || "—"}
          </div>
          {isDismissed && dismissalDateLabel ? (
            <div
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                marginTop: "4px",
                lineHeight: 1.4,
              }}
            >
              Дата увольнения: {dismissalDateLabel}
            </div>
          ) : null}
        </div>
      </div>

      {/* Contact icons */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginTop: "14px",
          borderTop: "1px solid #f1f5f9",
          paddingTop: "12px",
        }}
      >
        {employee.email && (
          <ContactIcon
            icon={<Mail style={{ width: "16px", height: "16px" }} />}
            href={`mailto:${employee.email}`}
            title={employee.email}
          />
        )}
        {employee.phone && (
          <ContactIcon
            icon={<Phone style={{ width: "16px", height: "16px" }} />}
            href={`tel:${employee.phone}`}
            title={employee.phone}
          />
        )}
      </div>
    </div>
  );
}
