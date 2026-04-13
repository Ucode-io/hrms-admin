import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { observer } from "mobx-react-lite";
import { ArrowLeft, Search } from "lucide-react";
import Select, { type SingleValue, type StylesConfig } from "react-select";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  type Edge,
  type NodeMouseHandler,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import { Modal } from "../../../components/ui/modal";
import companyStore from "../../../store/company.store";
import { type Employee, useEmployeesQuery } from "../../../api/services/employee.service";
import {
  type OrgStructureNode,
  useOrgStructureReportQuery,
} from "../../../api/services/reports.service";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 132;
const HORIZONTAL_GAP = 42;
const VERTICAL_GAP = 100;
const ROOT_GAP = 80;
const CHART_PADDING = 40;

type OrgNodeData = {
  nodeId: string;
  departmentTitle: string;
  managerName: string;
  managerInitials: string;
  subtitle: string;
  borderColor: string;
  backgroundColor: string;
  avatarColor: string;
  hasParent: boolean;
  hasChildren: boolean;
  isHighlighted: boolean;
};

type DepartmentTreeOption = {
  value: string;
  label: string;
  hierarchyLevel: number;
  parentId: string | null;
};

type LevelFilterOption = {
  value: string;
  label: string;
  hierarchyLevel: number;
};

const COLOR_PALETTE = [
  {
    border: "#3B82F6",
    background: "#EFF6FF",
    avatar: "#315BDA",
  },
  {
    border: "#8B5CF6",
    background: "#F5F3FF",
    avatar: "#7C3AED",
  },
  {
    border: "#0E7490",
    background: "#ECFEFF",
    avatar: "#2E8B85",
  },
  {
    border: "#43A047",
    background: "#F0FDF4",
    avatar: "#43A047",
  },
];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить оргструктуру. Попробуйте снова.";
};

const getPaletteByLevel = (level: number) => {
  const index = Math.max(0, (level - 1) % COLOR_PALETTE.length);
  return COLOR_PALETTE[index];
};

const buildSubtitle = (node: OrgStructureNode): string => {
  const position = node.manager?.position_title || "Руководитель";
  const peopleCount = Number.isFinite(Number(node.direct_employees_count))
    ? Number(node.direct_employees_count)
    : 0;

  if (node.parent_id && peopleCount > 0) {
    return `${position} • ${peopleCount} чел.`;
  }

  return position;
};

const getEmployeeFullName = (employee: Employee): string => {
  const fullName = [employee.second_name, employee.first_name, employee.middle_name]
    .filter((item) => typeof item === "string" && item.trim())
    .join(" ")
    .trim();

  if (fullName) {
    return fullName;
  }

  if (employee.email && String(employee.email).trim()) {
    return String(employee.email).trim();
  }

  if (employee.phone && String(employee.phone).trim()) {
    return String(employee.phone).trim();
  }

  return "Сотрудник";
};

const getEmployeeInitials = (employee: Employee): string => {
  const first = typeof employee.first_name === "string" ? employee.first_name.trim() : "";
  const second = typeof employee.second_name === "string" ? employee.second_name.trim() : "";
  const initials = `${second.charAt(0)}${first.charAt(0)}`.trim().toUpperCase();
  if (initials) {
    return initials;
  }

  const fallback = getEmployeeFullName(employee).slice(0, 2).toUpperCase();
  return fallback || "U";
};

const getEmployeeSubtitle = (employee: Employee): string => {
  const position = employee.positions_id_data?.title || "";
  const department = employee.departments_id_data?.title || "";
  return [position, department].filter(Boolean).join(" • ");
};

const getFilterSelectStyles = <
  Option extends {
    hierarchyLevel?: number;
  },
>(): StylesConfig<Option, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 12,
    borderColor: state.isFocused ? "#cbd5e1" : "#e5e7eb",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "1px 10px",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    fontSize: 14,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    paddingRight: 4,
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    padding: 6,
    "&:hover": {
      color: "#64748b",
    },
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    padding: 6,
    "&:hover": {
      color: "#64748b",
    },
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
    fontSize: 14,
  }),
  singleValue: (base) => ({
    ...base,
    color: "#334155",
    fontSize: 14,
  }),
  option: (base, state) => ({
    ...base,
    padding: "8px 12px",
    paddingLeft: `${12 + Math.max(0, Number(state.data.hierarchyLevel || 1) - 1) * 18}px`,
    backgroundColor: state.isSelected ? "#e2e8f0" : state.isFocused ? "#f8fafc" : "#fff",
    color: "#1f2937",
    cursor: "pointer",
    fontSize: 14,
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
  }),
  menuList: (base) => ({
    ...base,
    paddingTop: 4,
    paddingBottom: 4,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
});

const OrgNodeCard = ({ data }: { data: OrgNodeData }) => {
  return (
    <div
      className="min-w-[220px] cursor-pointer rounded-2xl border-2 px-4 py-3 text-center shadow-sm transition hover:shadow-md"
      style={{
        borderColor: data.isHighlighted ? "#f59e0b" : data.borderColor,
        backgroundColor: data.isHighlighted ? "#fffbeb" : data.backgroundColor,
        boxShadow: data.isHighlighted ? "0 0 0 2px rgba(245, 158, 11, 0.25)" : undefined,
      }}
      title={`Открыть сотрудников: ${data.managerName}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: data.hasParent ? 1 : 0 }}
        className="!h-2 !w-2 !border-0 !bg-slate-300"
      />

      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-[26px] font-semibold text-white"
        style={{ backgroundColor: data.avatarColor }}
      >
        {data.managerInitials}
      </div>

      <p className="mt-3 text-lg font-semibold text-slate-800">{data.managerName}</p>
      <p className="mt-1 text-base font-medium text-slate-500">{data.subtitle}</p>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: data.hasChildren ? 1 : 0 }}
        className="!h-2 !w-2 !border-0 !bg-slate-300"
      />
    </div>
  );
};

const buildHierarchyLayout = (
  nodes: OrgStructureNode[],
  highlightedNodeIds: Set<string>
) => {
  if (nodes.length === 0) {
    return {
      graphNodes: [] as Node<OrgNodeData>[],
      graphEdges: [] as Edge[],
      maxDepth: 1,
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, string[]>();

  for (const node of nodes) {
    if (!node.parent_id || !nodeById.has(node.parent_id)) {
      continue;
    }

    if (!childrenByParent.has(node.parent_id)) {
      childrenByParent.set(node.parent_id, []);
    }
    childrenByParent.get(node.parent_id)?.push(node.id);
  }

  for (const childIds of childrenByParent.values()) {
    childIds.sort((leftId, rightId) => {
      const leftTitle = nodeById.get(leftId)?.title || "";
      const rightTitle = nodeById.get(rightId)?.title || "";
      return leftTitle.localeCompare(rightTitle, "ru");
    });
  }

  const roots = nodes
    .filter((node) => !node.parent_id || !nodeById.has(node.parent_id))
    .sort((left, right) => left.title.localeCompare(right.title, "ru"))
    .map((node) => node.id);

  const subtreeWidthMemo = new Map<string, number>();
  const depthByNodeId = new Map<string, number>();

  const getSubtreeWidth = (nodeId: string): number => {
    if (subtreeWidthMemo.has(nodeId)) {
      return subtreeWidthMemo.get(nodeId) as number;
    }

    const childIds = childrenByParent.get(nodeId) || [];
    if (childIds.length === 0) {
      subtreeWidthMemo.set(nodeId, NODE_WIDTH);
      return NODE_WIDTH;
    }

    const childrenWidth = childIds.reduce((sum, childId) => sum + getSubtreeWidth(childId), 0);
    const totalChildrenWidth = childrenWidth + (childIds.length - 1) * HORIZONTAL_GAP;
    const nodeWidth = Math.max(NODE_WIDTH, totalChildrenWidth);
    subtreeWidthMemo.set(nodeId, nodeWidth);
    return nodeWidth;
  };

  const positionByNodeId = new Map<string, { x: number; y: number }>();

  const placeNode = (nodeId: string, leftX: number, depth: number) => {
    const nodeWidth = getSubtreeWidth(nodeId);
    const centerX = leftX + nodeWidth / 2;
    const x = centerX - NODE_WIDTH / 2;
    const y = CHART_PADDING + (depth - 1) * (NODE_HEIGHT + VERTICAL_GAP);

    positionByNodeId.set(nodeId, { x, y });
    depthByNodeId.set(nodeId, depth);

    const childIds = childrenByParent.get(nodeId) || [];
    if (childIds.length === 0) {
      return;
    }

    const totalChildrenWidth =
      childIds.reduce((sum, childId) => sum + getSubtreeWidth(childId), 0) +
      (childIds.length - 1) * HORIZONTAL_GAP;
    let childLeftX = leftX + (nodeWidth - totalChildrenWidth) / 2;

    for (const childId of childIds) {
      placeNode(childId, childLeftX, depth + 1);
      childLeftX += getSubtreeWidth(childId) + HORIZONTAL_GAP;
    }
  };

  const totalRootsWidth =
    roots.reduce((sum, rootId) => sum + getSubtreeWidth(rootId), 0) + Math.max(0, roots.length - 1) * ROOT_GAP;
  let rootLeftX = CHART_PADDING;

  if (roots.length > 0 && totalRootsWidth < 1200) {
    rootLeftX += (1200 - totalRootsWidth) / 2;
  }

  for (const rootId of roots) {
    placeNode(rootId, rootLeftX, 1);
    rootLeftX += getSubtreeWidth(rootId) + ROOT_GAP;
  }

  const graphNodes: Node<OrgNodeData>[] = nodes.map((node) => {
    const palette = getPaletteByLevel(node.hierarchy_level);
    const managerName = node.manager?.full_name || "Не назначен";
    const managerInitials = node.manager?.initials || "U";

    return {
      id: node.id,
      type: "orgNode",
      position: positionByNodeId.get(node.id) || { x: 0, y: 0 },
      draggable: false,
      selectable: true,
      data: {
        nodeId: node.id,
        departmentTitle: node.title,
        managerName,
        managerInitials,
        subtitle: buildSubtitle(node),
        borderColor: palette.border,
        backgroundColor: palette.background,
        avatarColor: palette.avatar,
        hasParent: Boolean(node.parent_id && nodeById.has(node.parent_id)),
        hasChildren: (childrenByParent.get(node.id)?.length || 0) > 0,
        isHighlighted: highlightedNodeIds.has(node.id),
      },
    };
  });

  const graphEdges: Edge[] = nodes
    .filter((node) => node.parent_id && nodeById.has(node.parent_id))
    .map((node) => ({
      id: `edge:${node.parent_id}:${node.id}`,
      source: String(node.parent_id),
      target: node.id,
      type: "smoothstep",
      animated: false,
      style: {
        stroke: "#CBD5E1",
        strokeWidth: 2,
      },
    }));

  const maxDepth =
    Math.max(...Array.from(depthByNodeId.values()), 1);

  return {
    graphNodes,
    graphEdges,
    maxDepth,
  };
};

function OrganizationStructureModule() {
  const [searchInput, setSearchInput] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedHierarchyLevel, setSelectedHierarchyLevel] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const selectPortalTarget = typeof document !== "undefined" ? document.body : null;

  const requestData = useMemo(() => {
    const payload: Record<string, unknown> = {};

    const companyGuid =
      companyStore.company?.guid && typeof companyStore.company.guid === "string"
        ? companyStore.company.guid
        : "";

    if (companyGuid) {
      payload.companies_id = companyGuid;
    }

    if (selectedDepartmentId) {
      payload.department_id = selectedDepartmentId;
    }

    if (selectedHierarchyLevel) {
      payload.hierarchy_level = Number(selectedHierarchyLevel);
    }

    return payload;
  }, [selectedDepartmentId, selectedHierarchyLevel, companyStore.company?.guid]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useOrgStructureReportQuery(requestData);

  const result = data?.result;
  const cards = result?.cards || {};
  const chartNodes = result?.chart?.nodes || [];
  const departments = result?.filters?.departments || [];
  const levels = result?.filters?.levels || [];
  const departmentOptions = useMemo<DepartmentTreeOption[]>(
    () =>
      departments.map((department) => ({
        value: department.guid,
        label: department.title,
        hierarchyLevel: Number(department.hierarchy_level || 1),
        parentId: department.parent_id,
      })),
    [departments]
  );
  const levelOptions = useMemo<LevelFilterOption[]>(
    () =>
      levels.map((level) => ({
        value: String(level.value),
        label: level.label,
        hierarchyLevel: Number(level.value || 1),
      })),
    [levels]
  );
  const selectedDepartmentOption = useMemo(
    () => departmentOptions.find((option) => option.value === selectedDepartmentId) || null,
    [departmentOptions, selectedDepartmentId]
  );
  const selectedLevelOption = useMemo(
    () => levelOptions.find((option) => option.value === selectedHierarchyLevel) || null,
    [levelOptions, selectedHierarchyLevel]
  );
  const highlightedNodeIds = useMemo(() => {
    const normalized = searchInput.trim().toLowerCase();
    if (!normalized) {
      return new Set<string>();
    }

    const matches = new Set<string>();
    for (const node of chartNodes) {
      const title = typeof node.title === "string" ? node.title.toLowerCase() : "";
      if (title.includes(normalized)) {
        matches.add(node.id);
      }
    }

    return matches;
  }, [chartNodes, searchInput]);
  const nodeById = useMemo(
    () => new Map(chartNodes.map((node) => [node.id, node])),
    [chartNodes]
  );

  const layout = useMemo(
    () => buildHierarchyLayout(chartNodes, highlightedNodeIds),
    [chartNodes, highlightedNodeIds]
  );
  const highlightedGraphNodes = useMemo(
    () => layout.graphNodes.filter((node) => highlightedNodeIds.has(node.id)),
    [highlightedNodeIds, layout.graphNodes]
  );
  const chartHeight = useMemo(
    () => Math.max(540, layout.maxDepth * (NODE_HEIGHT + VERTICAL_GAP) + CHART_PADDING * 2),
    [layout.maxDepth]
  );

  useEffect(() => {
    if (!flowInstance) return;

    const normalizedSearch = searchInput.trim();
    if (!normalizedSearch || highlightedGraphNodes.length === 0) {
      return;
    }

    if (highlightedGraphNodes.length === 1) {
      const target = highlightedGraphNodes[0];
      const centerX = target.position.x + NODE_WIDTH / 2;
      const centerY = target.position.y + NODE_HEIGHT / 2;
      flowInstance.setCenter(centerX, centerY, { zoom: 1.2, duration: 450 });
      return;
    }

    flowInstance.fitView({
      nodes: highlightedGraphNodes,
      padding: 0.5,
      duration: 450,
      maxZoom: 1.1,
    });
  }, [flowInstance, highlightedGraphNodes, searchInput]);

  const totalEmployees = Number(cards.total_employees || 0);
  const departmentsCount = Number(cards.departments_count || 0);
  const managersCount = Number(cards.managers_count || 0);
  const hierarchyLevels = Number(cards.hierarchy_levels || 0);

  const nodeTypes = useMemo(() => ({ orgNode: OrgNodeCard }), []);
  const onNodeClick = useMemo<NodeMouseHandler<OrgNodeData>>(
    () => (_event, node) => {
      setSelectedNodeId(node.id);
      setEmployeeSearch("");
    },
    []
  );

  const { data: employeesData, isLoading: isEmployeesLoading } = useEmployeesQuery({
    limit: 5000,
    offset: 0,
  });

  const allEmployees = useMemo<Employee[]>(
    () => ((employeesData?.response || []) as Employee[]),
    [employeesData?.response]
  );
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) || null : null;
  const selectedEmployees = useMemo(() => {
    if (!selectedNode || !selectedNodeId) return [];

    const managerGuid = selectedNode.manager?.guid || null;
    const filtered = allEmployees.filter((employee) => {
      const departmentId =
        typeof employee.departments_id === "string" && employee.departments_id.trim()
          ? employee.departments_id.trim()
          : "";
      if (!departmentId || departmentId !== selectedNodeId) {
        return false;
      }
      if (managerGuid && employee.guid === managerGuid) {
        return false;
      }
      return true;
    });

    const normalizedSearch = employeeSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return filtered;
    }

    return filtered.filter((employee) => {
      const searchTarget = [
        getEmployeeFullName(employee),
        employee.email || "",
        employee.phone || "",
        employee.positions_id_data?.title || "",
        employee.departments_id_data?.title || "",
      ]
        .join(" ")
        .toLowerCase();

      return searchTarget.includes(normalizedSearch);
    });
  }, [allEmployees, employeeSearch, selectedNode, selectedNodeId]);

  const resetFilters = () => {
    setSearchInput("");
    setSelectedDepartmentId("");
    setSelectedHierarchyLevel("");
  };

  if (isLoading) {
    return (
      <>
        <PageMeta title="Орг структура | HRMS" description="Оргструктура компании" />
        <div className="flex min-h-[340px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta title="Орг структура | HRMS" description="Оргструктура компании" />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">{getErrorMessage(error)}</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-error-600 px-4 text-sm font-semibold text-white transition hover:bg-error-700"
          >
            Повторить
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Орг структура | HRMS" description="Оргструктура компании" />

      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4">
            <Link
              to="/dashboard"
              className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
            >
              <ArrowLeft size={14} />
              Назад
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900">Орг структура</h1>
            <p className="mt-1 text-sm text-gray-500">
              Визуальная структура подразделений и руководителей компании
            </p>
          </div>

          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative w-full md:max-w-[270px]">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Поиск отдела..."
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                />
              </label>

              <div className="min-w-[230px] flex-1 md:flex-none">
                <Select<DepartmentTreeOption, false>
                  options={departmentOptions}
                  value={selectedDepartmentOption}
                  onChange={(option: SingleValue<DepartmentTreeOption>) =>
                    setSelectedDepartmentId(option?.value || "")
                  }
                  placeholder="Все отделы"
                  isSearchable
                  isClearable
                  styles={getFilterSelectStyles<DepartmentTreeOption>()}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                  noOptionsMessage={() => "Отделы не найдены"}
                  formatOptionLabel={(option, meta) => {
                    if (meta.context === "value") {
                      return <span>{option.label}</span>;
                    }

                    return (
                      <div className="flex items-center gap-2">
                        {option.hierarchyLevel > 1 ? (
                          <span className="text-xs text-slate-300">└</span>
                        ) : null}
                        <span className="font-medium text-slate-700">{option.label}</span>
                        <span className="ml-auto text-xs text-slate-400">L{option.hierarchyLevel}</span>
                      </div>
                    );
                  }}
                />
              </div>

              <div className="min-w-[210px] flex-1 md:flex-none">
                <Select<LevelFilterOption, false>
                  options={levelOptions}
                  value={selectedLevelOption}
                  onChange={(option: SingleValue<LevelFilterOption>) =>
                    setSelectedHierarchyLevel(option?.value || "")
                  }
                  placeholder="Все уровни"
                  isSearchable={false}
                  isClearable
                  styles={getFilterSelectStyles<LevelFilterOption>()}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                  noOptionsMessage={() => "Уровни не найдены"}
                />
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Сбросить
              </button>
            </div>
          </div>

          <div className="grid gap-4 border-b border-gray-100 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4">
              <p className="text-sm text-gray-500">Всего сотрудников</p>
              <p className="mt-2 text-4xl font-semibold text-gray-900">{totalEmployees}</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4">
              <p className="text-sm text-gray-500">Отделов</p>
              <p className="mt-2 text-4xl font-semibold text-gray-900">{departmentsCount}</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4">
              <p className="text-sm text-gray-500">Менеджеров</p>
              <p className="mt-2 text-4xl font-semibold text-gray-900">{managersCount}</p>
            </article>
            <article className="rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4">
              <p className="text-sm text-gray-500">Уровней иерархии</p>
              <p className="mt-2 text-4xl font-semibold text-gray-900">{hierarchyLevels}</p>
            </article>
          </div>

          <div className="relative">
            {isFetching ? (
              <div className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs font-medium text-gray-600 shadow-sm">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
                Обновляем данные...
              </div>
            ) : null}

            {layout.graphNodes.length === 0 ? (
              <div className="flex h-[440px] items-center justify-center text-sm text-gray-500">
                Нет данных по выбранным фильтрам
              </div>
            ) : (
              <div style={{ height: chartHeight }}>
                <ReactFlow
                  nodes={layout.graphNodes}
                  edges={layout.graphEdges}
                  nodeTypes={nodeTypes}
                  onInit={setFlowInstance}
                  fitView
                  fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
                  panOnScroll
                  zoomOnScroll
                  zoomOnPinch
                  zoomOnDoubleClick={false}
                  panOnDrag
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                  proOptions={{ hideAttribution: true }}
                  className="bg-slate-50/40"
                  onNodeClick={onNodeClick}
                >
                  <Controls position="bottom-right" showInteractive={false} />
                  <MiniMap
                    position="bottom-left"
                    zoomable
                    pannable
                    style={{ width: 160, height: 100, borderRadius: 12, border: "1px solid #E2E8F0" }}
                    nodeStrokeColor="#CBD5E1"
                    nodeColor="#EFF6FF"
                    maskColor="rgba(148, 163, 184, 0.08)"
                  />
                  <Background color="#E2E8F0" gap={20} size={1} />
                </ReactFlow>
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal
        isOpen={Boolean(selectedNode)}
        onClose={() => setSelectedNodeId(null)}
        className="max-w-[760px] p-5"
      >
        <div className="space-y-4">
          <div className="pr-10">
            <h2 className="text-xl font-semibold text-slate-900">
              {selectedNode?.manager?.full_name || "Руководитель"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedNode?.manager?.position_title || "Руководитель"} •{" "}
              {selectedNode?.title || "Отдел"}
            </p>
          </div>

          <label className="relative block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="Поиск сотрудника..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-brand-300"
            />
          </label>

          <div className="max-h-[460px] overflow-y-auto rounded-xl border border-slate-200">
            {isEmployeesLoading ? (
              <div className="flex h-28 items-center justify-center">
                <Spinner />
              </div>
            ) : selectedEmployees.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Сотрудники не найдены
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {selectedEmployees.map((employee) => (
                  <li key={employee.guid} className="flex items-center gap-3 px-4 py-3">
                    {employee.photo ? (
                      <img
                        src={employee.photo}
                        alt={getEmployeeFullName(employee)}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
                        {getEmployeeInitials(employee)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {getEmployeeFullName(employee)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {getEmployeeSubtitle(employee) || employee.email || employee.phone || "—"}
                      </p>
                    </div>

                    <Link
                      to={`/employees/${employee.guid}`}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      onClick={() => setSelectedNodeId(null)}
                    >
                      Профиль
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

export default observer(OrganizationStructureModule);
