import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { observer } from "mobx-react-lite";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Select, { type SingleValue, type StylesConfig } from "react-select";
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type NodeMouseHandler,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import PageMeta from "../../../components/common/PageMeta";
import ExpandableSearchInput from "../../../components/form/ExpandableSearchInput";
import Spinner from "../../../components/ui/Spinner";
import { Modal } from "../../../components/ui/modal";
import companyStore from "../../../store/company.store";
import { type Employee } from "../../../api/services/employee.service";
import {
  type Department,
  useCreateDepartment,
  useDeleteDepartment,
  useUpdateDepartment,
} from "../../../api/services/department.service";
import {
  type OrgStructureNode,
  useOrgStructureReportQuery,
} from "../../../api/services/reports.service";
import type { Option } from "../../Settings/Departments/types";
import DepartmentUpsertModal from "../../Settings/Departments/components/DepartmentUpsertModal";
import { resolveDepartmentLeaderName } from "../../Settings/Departments/utils";

import { translate, useTranslation } from "../../../i18n";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 132;
const HORIZONTAL_GAP = 52;
const VERTICAL_GAP = 120;
const ROOT_GAP = 80;
const CHART_PADDING = 40;
const ROOT_KEY = "__root__";
const UNASSIGNED_POSITION_KEY = "__unassigned_position__";
const VERTICAL_MODE_X_GAP = 180;
const VERTICAL_MODE_Y_GAP = 28;
const POSITION_MODE_HORIZONTAL_GAP = 64;
const POSITION_MODE_VERTICAL_GAP = 120;
const POSITION_MODE_STACK_GAP = 24;
const POSITION_MODE_STACK_INDENT = 36;

type StructureViewMode = "departments" | "positions";
type OrgStructureDisplayNode = OrgStructureNode & {
  node_kind?: StructureViewMode;
  employeeDepartmentTitle?: string;
};
type LayoutMode = "topDown" | "leftRight" | "topDownVerticalChildren";

type Point = {
  x: number;
  y: number;
};

type OrgEdgeData = {
  sharedBusY?: number;
};

type OrgNodeData = {
  nodeId: string;
  departmentTitle: string;
  managerName: string;
  managerInitials: string;
  managerPhoto: string | null;
  subtitle: string;
  borderColor: string;
  backgroundColor: string;
  avatarColor: string;
  hasParent: boolean;
  hasChildren: boolean;
  showCollapseControl: boolean;
  isCollapsed: boolean;
  isHighlighted: boolean;
  onAddChild?: (nodeId: string) => void;
  onToggleCollapse?: (nodeId: string) => void;
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
  return translate("org_structure.load_error");
};

const getPaletteByLevel = (level: number) => {
  const index = Math.max(0, (level - 1) % COLOR_PALETTE.length);
  return COLOR_PALETTE[index];
};

const CYRILLIC_TO_LATIN_LOOKALIKES: Record<string, string> = {
  А: "A", В: "B", С: "C", Е: "E", Н: "H", К: "K",
  М: "M", О: "O", Р: "P", Т: "T", Х: "X", У: "Y",
  а: "a", в: "b", с: "c", е: "e", н: "h", к: "k",
  м: "m", о: "o", р: "p", т: "t", х: "x", у: "y",
};

const normalizeTitleForRank = (raw: string): string => {
  const trimmed = String(raw || "").trim().toUpperCase();
  let result = "";
  for (const char of trimmed) {
    result += CYRILLIC_TO_LATIN_LOOKALIKES[char] ?? char;
  }
  return result.toUpperCase();
};

const getPositionTitleRank = (rawTitle: string): number => {
  const t = normalizeTitleForRank(rawTitle);
  if (!t) return 999;
  if (/^CEO\b/.test(t) || /\bCHIEF EXECUTIVE\b/.test(t)) return 1;
  if (/^C[A-Z]O\b/.test(t)) return 2; // CPO, CTO, CFO, COO, CMO, CIO, etc.
  if (/\bVP\b/.test(t) || /\bVICE PRESIDENT\b/.test(t)) return 3;
  if (/\bHEAD OF\b/.test(t)) return 4;
  if (/\bDIRECTOR\b/.test(t)) return 5;
  if (/\bCHAPTER\b/.test(t)) return 6;
  if (/\bTEAM LEAD\b/.test(t) || /\bTECH LEAD\b/.test(t)) return 7;
  if (/^PM\b/.test(t) || /\bPROJECT MANAGER\b/.test(t) || /\bPRODUCT MANAGER\b/.test(t)) return 8;
  if (/\bMANAGER\b/.test(t)) return 9;
  if (/\bSENIOR\b/.test(t)) return 10;
  if (/\bMIDDLE\b/.test(t)) return 11;
  if (/\bJUNIOR\b/.test(t) || /\bINTERN\b/.test(t) || /\bTRAINEE\b/.test(t)) return 12;
  return 50;
};

const buildSubtitle = (node: OrgStructureDisplayNode): string => {
  if (node.node_kind === "positions") {
    if (!node.manager?.guid && typeof node.id === "string" && node.id.startsWith("position:")) {
      return "";
    }

    if (node.manager?.guid) {
      return [node.manager?.position_title || translate("org_structure.no_position"), node.employeeDepartmentTitle]
        .filter(Boolean)
        .join(" • ");
    }
    const peopleCount = Number.isFinite(Number(node.direct_employees_count))
      ? Number(node.direct_employees_count)
      : 0;
    return translate("org_structure.people_count", { count: peopleCount });
  }

  const position = node.manager?.position_title || translate("org_structure.manager");
  const peopleCount = Number.isFinite(Number(node.direct_employees_count))
    ? Number(node.direct_employees_count)
    : 0;

  if (node.parent_id && peopleCount > 0) {
    return `${position} • ${translate("org_structure.people_count", { count: peopleCount })}`;
  }

  return position;
};

const buildPositionNodes = (positions: PositionItem[], employees: Employee[]): OrgStructureDisplayNode[] => {
  const positionsById = new Map<string, PositionItem>();
  for (const position of positions) {
    if (!position.guid) continue;
    positionsById.set(position.guid, position);
  }

  const getEmployeePositionId = (employee: Employee): string => {
    const rawPositionId =
      typeof employee.positions_id === "string" ? employee.positions_id.trim() : "";
    return rawPositionId && positionsById.has(rawPositionId) ? rawPositionId : UNASSIGNED_POSITION_KEY;
  };

  const getPositionTitle = (employee: Employee): string => {
    const positionId = getEmployeePositionId(employee);
    return (
      employee.positions_id_data?.title ||
      (positionId !== UNASSIGNED_POSITION_KEY ? positionsById.get(positionId)?.title : "") ||
      translate("org_structure.no_position")
    );
  };

  const employeesByPosition = new Map<string, Employee[]>();
  for (const employee of employees) {
    const positionId = getEmployeePositionId(employee);
    if (!employeesByPosition.has(positionId)) {
      employeesByPosition.set(positionId, []);
    }
    employeesByPosition.get(positionId)?.push(employee);
  }

  for (const groupEmployees of employeesByPosition.values()) {
    groupEmployees.sort((left, right) =>
      getEmployeeFullName(left).localeCompare(getEmployeeFullName(right), "ru")
    );
  }

  const getPositionTitleKey = (positionId: string): string => {
    if (positionId === UNASSIGNED_POSITION_KEY) return "";
    const position = positionsById.get(positionId);
    return ((position?.title as string) || "").trim().toLowerCase();
  };

  const trueParentPositionMemo = new Map<string, string | null>();
  const getTrueParentPositionId = (positionId: string): string | null => {
    if (positionId === UNASSIGNED_POSITION_KEY || !positionsById.has(positionId)) {
      return null;
    }
    if (trueParentPositionMemo.has(positionId)) {
      return trueParentPositionMemo.get(positionId) as string | null;
    }

    const myTitleKey = getPositionTitleKey(positionId);
    let currentId = positionId;
    const walked = new Set<string>([currentId]);

    while (true) {
      const current = positionsById.get(currentId);
      const rawParent =
        current && typeof current.positions_id === "string" ? current.positions_id.trim() : "";
      if (!rawParent || !positionsById.has(rawParent) || walked.has(rawParent)) {
        trueParentPositionMemo.set(positionId, null);
        return null;
      }
      walked.add(rawParent);

      const parentTitleKey = getPositionTitleKey(rawParent);
      if (myTitleKey && parentTitleKey === myTitleKey) {
        currentId = rawParent;
        continue;
      }

      trueParentPositionMemo.set(positionId, rawParent);
      return rawParent;
    }
  };

  const positionLevelMemo = new Map<string, number>();
  const getPositionLevel = (positionId: string, visited = new Set<string>()): number => {
    if (positionId === UNASSIGNED_POSITION_KEY || !positionsById.has(positionId)) {
      return 1;
    }

    if (positionLevelMemo.has(positionId)) {
      return positionLevelMemo.get(positionId) as number;
    }

    if (visited.has(positionId)) {
      return 1;
    }

    visited.add(positionId);
    const trueParent = getTrueParentPositionId(positionId);
    const level = trueParent ? getPositionLevel(trueParent, visited) + 1 : 1;

    positionLevelMemo.set(positionId, level);
    return level;
  };

  const getParentEmployeeId = (employee: Employee): string | null => {
    const positionId = getEmployeePositionId(employee);
    const trueParentPositionId = getTrueParentPositionId(positionId);
    if (!trueParentPositionId) {
      return null;
    }

    const parentEmployee = employeesByPosition.get(trueParentPositionId)?.[0];
    return parentEmployee?.guid && parentEmployee.guid !== employee.guid
      ? `employee:${parentEmployee.guid}`
      : null;
  };

  const nodes = employees.map((employee) => {
    const positionId = getEmployeePositionId(employee);
    const positionTitle = getPositionTitle(employee);
    const fullName = getEmployeeFullName(employee);

    return {
      id: `employee:${employee.guid}`,
      department_guid: positionId,
      title: fullName,
      parent_id: getParentEmployeeId(employee),
      hierarchy_level: getPositionLevel(positionId),
      direct_employees_count: 0,
      total_employees_count: 1,
      children_count: 0,
      node_kind: "positions",
      employeeDepartmentTitle: employee.departments_id_data?.title || "",
      manager: {
        guid: employee.guid,
        full_name: fullName,
        first_name: employee.first_name || null,
        second_name: employee.second_name || null,
        middle_name: employee.middle_name || null,
        email: employee.email || null,
        phone: employee.phone || null,
        photo: employee.photo || null,
        initials: getEmployeeInitials(employee),
        position_title: positionTitle,
      },
    };
  });

  const childrenByParent = new Map<string, OrgStructureDisplayNode[]>();
  for (const node of nodes) {
    if (!node.parent_id) continue;
    if (!childrenByParent.has(node.parent_id)) {
      childrenByParent.set(node.parent_id, []);
    }
    childrenByParent.get(node.parent_id)?.push(node);
  }

  const totalEmployeesByNodeId = new Map<string, number>();
  const getTotalEmployees = (nodeId: string, visited = new Set<string>()): number => {
    if (totalEmployeesByNodeId.has(nodeId)) {
      return totalEmployeesByNodeId.get(nodeId) as number;
    }

    if (visited.has(nodeId)) {
      return 0;
    }

    visited.add(nodeId);
    const total = (childrenByParent.get(nodeId) || []).reduce(
      (sum, child) => sum + getTotalEmployees(child.id, visited),
      1
    );
    totalEmployeesByNodeId.set(nodeId, total);
    visited.delete(nodeId);
    return total;
  };

  for (const node of nodes) {
    const childrenCount = childrenByParent.get(node.id)?.length || 0;
    node.direct_employees_count = childrenCount;
    node.children_count = childrenCount;
    node.total_employees_count = getTotalEmployees(node.id);
  }

  return nodes;
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

  return translate("org_structure.employee");
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
  const { t } = useTranslation();
  return (
    <div
      className="group relative cursor-pointer overflow-visible rounded-2xl border-2 px-4 py-3 shadow-sm transition hover:shadow-md"
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        borderColor: data.isHighlighted ? "#f59e0b" : data.borderColor,
        backgroundColor: data.isHighlighted ? "#fffbeb" : data.backgroundColor,
        boxShadow: data.isHighlighted ? "0 0 0 2px rgba(245, 158, 11, 0.25)" : undefined,
      }}
      title={t("org_structure.open_employees", { name: data.managerName })}
    >
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        style={{ opacity: data.hasParent ? 1 : 0 }}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />

      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[16px] font-extrabold text-white"
          style={{ backgroundColor: data.avatarColor }}
        >
          {data.managerPhoto ? (
            <img src={data.managerPhoto} alt={data.managerName} className="h-full w-full object-cover" />
          ) : (
            data.managerInitials
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="m-0 truncate text-[20px] font-bold leading-tight text-slate-800">{data.managerName}</p>
          <p className="m-0 mt-1 truncate text-sm font-medium text-slate-500">{data.subtitle}</p>
        </div>
      </div>
      {data.hasChildren && data.showCollapseControl ? (
        <button
          type="button"
          className="pointer-events-none absolute bottom-0 left-1/2 z-10 inline-flex h-7 w-7 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-600 opacity-0 shadow-sm transition group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-slate-50 focus:pointer-events-auto focus:opacity-100"
          title={data.isCollapsed ? t("org_structure.expand_children") : t("org_structure.collapse_children")}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleCollapse?.(data.nodeId);
          }}
        >
          {data.isCollapsed ? "+" : "-"}
        </button>
      ) : null}
      {data.onAddChild ? (
        <button
          type="button"
          className={`pointer-events-none absolute bottom-0 inline-flex h-7 w-7 translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 opacity-0 shadow-sm transition group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-slate-50 focus:pointer-events-auto focus:opacity-100 ${
            data.hasChildren ? "left-1/2 translate-x-[14px]" : "left-1/2 -translate-x-1/2"
          }`}
          title={t("org_structure.add_child_department")}
          onClick={(event) => {
            event.stopPropagation();
            data.onAddChild?.(data.nodeId);
          }}
        >
          <Plus size={14} />
        </button>
      ) : null}

      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        style={{ opacity: data.hasChildren ? 1 : 0 }}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      <Handle
        id="source-left"
        type="source"
        position={Position.Left}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
    </div>
  );
};

const buildRoundedPath = (rawPoints: Point[], radius = 12): string => {
  const points = rawPoints.filter((point, index, array) => {
    const prev = array[index - 1];
    return !prev || Math.abs(prev.x - point.x) > 0.5 || Math.abs(prev.y - point.y) > 0.5;
  });

  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const prevDistance = Math.hypot(current.x - prev.x, current.y - prev.y);
    const nextDistance = Math.hypot(next.x - current.x, next.y - current.y);
    const cornerRadius = Math.min(radius, prevDistance / 2, nextDistance / 2);

    const before = {
      x: current.x - ((current.x - prev.x) / prevDistance) * cornerRadius,
      y: current.y - ((current.y - prev.y) / prevDistance) * cornerRadius,
    };
    const after = {
      x: current.x + ((next.x - current.x) / nextDistance) * cornerRadius,
      y: current.y + ((next.y - current.y) / nextDistance) * cornerRadius,
    };

    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }

  const last = points[points.length - 1];
  return `${path} L ${last.x} ${last.y}`;
};

const OrgChartEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps) => {
  const isInnerStack = sourcePosition === Position.Left && targetPosition === Position.Left;
  const isTargetLeft = targetPosition === Position.Left;

  let points: Point[];

  if (isInnerStack) {
    const elbowX = Math.min(sourceX, targetX) - 28;
    points = [
      { x: sourceX, y: sourceY },
      { x: elbowX, y: sourceY },
      { x: elbowX, y: targetY },
      { x: targetX, y: targetY },
    ];
  } else {
    const sharedBusY =
      data && typeof data === "object" && "sharedBusY" in data && typeof data.sharedBusY === "number"
        ? data.sharedBusY
        : null;
    const verticalGap = Math.max(42, Math.min(86, Math.abs(targetY - sourceY) * 0.34));
    const busY = sharedBusY ?? sourceY + verticalGap;

    if (isTargetLeft) {
      const sideX = targetX - 28;
      points = [
        { x: sourceX, y: sourceY },
        { x: sourceX, y: busY },
        { x: sideX, y: busY },
        { x: sideX, y: targetY },
        { x: targetX, y: targetY },
      ];
    } else {
      points = [
        { x: sourceX, y: sourceY },
        { x: sourceX, y: busY },
        { x: targetX, y: busY },
        { x: targetX, y: targetY },
      ];
    }
  }

  return (
    <BaseEdge
      id={id}
      path={buildRoundedPath(points, 10)}
      style={{
        stroke: "#CBD5E1",
        strokeWidth: 1.5,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...style,
      }}
    />
  );
};

const orgEdgeTypes: EdgeTypes = {
  org: OrgChartEdge,
};

const buildHierarchyLayout = (
  nodes: OrgStructureDisplayNode[],
  highlightedNodeIds: Set<string>,
  onAddChild?: (nodeId: string) => void,
  layoutMode: LayoutMode = "topDown",
  collapsedNodeIds: Set<string> = new Set<string>(),
  onToggleCollapse?: (nodeId: string) => void
) => {
  if (nodes.length === 0) {
    return {
      graphNodes: [] as Node[],
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

  const rootsAll = nodes
    .filter((node) => !node.parent_id || !nodeById.has(node.parent_id))
    .sort((left, right) => left.title.localeCompare(right.title, "ru"))
    .map((node) => node.id);

  const visibleNodeIds = new Set<string>();
  const collectVisibleNodes = (nodeId: string) => {
    visibleNodeIds.add(nodeId);
    if (collapsedNodeIds.has(nodeId)) {
      return;
    }
    const childIds = childrenByParent.get(nodeId) || [];
    for (const childId of childIds) {
      collectVisibleNodes(childId);
    }
  };

  for (const rootId of rootsAll) {
    collectVisibleNodes(rootId);
  }

  const visibleNodes = nodes.filter((node) => visibleNodeIds.has(node.id));
  const visibleNodeById = new Map(visibleNodes.map((node) => [node.id, node]));
  const visibleChildrenByParent = new Map<string, string[]>();

  for (const node of visibleNodes) {
    if (!node.parent_id || !visibleNodeById.has(node.parent_id)) {
      continue;
    }

    if (!visibleChildrenByParent.has(node.parent_id)) {
      visibleChildrenByParent.set(node.parent_id, []);
    }
    visibleChildrenByParent.get(node.parent_id)?.push(node.id);
  }

  for (const childIds of visibleChildrenByParent.values()) {
    childIds.sort((leftId, rightId) => {
      const leftTitle = nodeById.get(leftId)?.title || "";
      const rightTitle = nodeById.get(rightId)?.title || "";
      return leftTitle.localeCompare(rightTitle, "ru");
    });
  }

  const roots = visibleNodes
    .filter((node) => !node.parent_id || !visibleNodeById.has(node.parent_id))
    .sort((left, right) => left.title.localeCompare(right.title, "ru"))
    .map((node) => node.id);

  const subtreeWidthMemo = new Map<string, number>();
  const subtreeHeightMemo = new Map<string, number>();
  const depthByNodeId = new Map<string, number>();

  const getSubtreeWidth = (nodeId: string): number => {
    if (subtreeWidthMemo.has(nodeId)) {
      return subtreeWidthMemo.get(nodeId) as number;
    }

    const childIds = visibleChildrenByParent.get(nodeId) || [];
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

  const getSubtreeHeight = (nodeId: string): number => {
    if (subtreeHeightMemo.has(nodeId)) {
      return subtreeHeightMemo.get(nodeId) as number;
    }

    const childIds = visibleChildrenByParent.get(nodeId) || [];
    if (childIds.length === 0) {
      subtreeHeightMemo.set(nodeId, NODE_HEIGHT);
      return NODE_HEIGHT;
    }

    const childrenHeight = childIds.reduce((sum, childId) => sum + getSubtreeHeight(childId), 0);
    const totalChildrenHeight = childrenHeight + (childIds.length - 1) * VERTICAL_MODE_Y_GAP;
    const nodeHeight = Math.max(NODE_HEIGHT, totalChildrenHeight);
    subtreeHeightMemo.set(nodeId, nodeHeight);
    return nodeHeight;
  };

  const placeNode = (nodeId: string, leftX: number, depth: number) => {
    const nodeWidth = getSubtreeWidth(nodeId);
    const centerX = leftX + nodeWidth / 2;
    const x = centerX - NODE_WIDTH / 2;
    const y = CHART_PADDING + (depth - 1) * (NODE_HEIGHT + VERTICAL_GAP);

    positionByNodeId.set(nodeId, { x, y });
    depthByNodeId.set(nodeId, depth);

    const childIds = visibleChildrenByParent.get(nodeId) || [];
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

  if (layoutMode === "leftRight") {
    const placeNodeLeftRight = (nodeId: string, topY: number, depth: number) => {
      const nodeHeight = getSubtreeHeight(nodeId);
      const centerY = topY + nodeHeight / 2;
      const x = CHART_PADDING + (depth - 1) * (NODE_WIDTH + VERTICAL_MODE_X_GAP);
      const y = centerY - NODE_HEIGHT / 2;

      positionByNodeId.set(nodeId, { x, y });
      depthByNodeId.set(nodeId, depth);

      const childIds = visibleChildrenByParent.get(nodeId) || [];
      if (childIds.length === 0) {
        return;
      }

      const totalChildrenHeight =
        childIds.reduce((sum, childId) => sum + getSubtreeHeight(childId), 0) +
        (childIds.length - 1) * VERTICAL_MODE_Y_GAP;
      let childTopY = topY + (nodeHeight - totalChildrenHeight) / 2;

      for (const childId of childIds) {
        placeNodeLeftRight(childId, childTopY, depth + 1);
        childTopY += getSubtreeHeight(childId) + VERTICAL_MODE_Y_GAP;
      }
    };

    let rootTopY = CHART_PADDING;
    for (const rootId of roots) {
      placeNodeLeftRight(rootId, rootTopY, 1);
      rootTopY += getSubtreeHeight(rootId) + ROOT_GAP;
    }
  } else if (layoutMode === "topDownVerticalChildren") {
    const childGroupsMemo = new Map<string, string[][]>();
    const subtreeWidthMemoVertical = new Map<string, number>();
    const subtreeHeightMemoVertical = new Map<string, number>();

    const getPositionGroupTitle = (nodeId: string): string => {
      const node = visibleNodeById.get(nodeId);
      const title = typeof node?.manager?.position_title === "string"
        ? node.manager.position_title.trim()
        : "";
      if (title) {
        return title;
      }
      return typeof node?.title === "string" ? node.title : "";
    };

    const getChildGroupsByPosition = (nodeId: string): string[][] => {
      if (childGroupsMemo.has(nodeId)) {
        return childGroupsMemo.get(nodeId) as string[][];
      }

      const childIds = visibleChildrenByParent.get(nodeId) || [];
      if (childIds.length === 0) {
        childGroupsMemo.set(nodeId, []);
        return [];
      }

      const groupsMap = new Map<string, string[]>();
      for (const childId of childIds) {
        const childNode = visibleNodeById.get(childId);
        const groupKey =
          childNode && typeof childNode.department_guid === "string" && childNode.department_guid.trim()
            ? childNode.department_guid.trim()
            : UNASSIGNED_POSITION_KEY;

        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, []);
        }
        groupsMap.get(groupKey)?.push(childId);
      }

      const groups = Array.from(groupsMap.entries()).map(([groupKey, ids]) => {
        ids.sort((leftId, rightId) => {
          const leftTitle = visibleNodeById.get(leftId)?.title || "";
          const rightTitle = visibleNodeById.get(rightId)?.title || "";
          return leftTitle.localeCompare(rightTitle, "ru");
        });

        const groupLevel = ids.reduce((minLevel, childId) => {
          const childLevel = Number(visibleNodeById.get(childId)?.hierarchy_level || 0) || 0;
          return minLevel === null || childLevel < minLevel ? childLevel : minLevel;
        }, null as number | null) ?? 0;

        const groupTitle = getPositionGroupTitle(ids[0]);

        return {
          groupKey,
          ids,
          groupTitle,
          groupLevel,
          groupRank: getPositionTitleRank(groupTitle),
        };
      });

      groups.sort((left, right) => {
        if (left.groupRank !== right.groupRank) {
          return left.groupRank - right.groupRank;
        }
        if (left.groupLevel !== right.groupLevel) {
          return left.groupLevel - right.groupLevel;
        }
        const byPosition = left.groupTitle.localeCompare(right.groupTitle, "ru");
        if (byPosition !== 0) {
          return byPosition;
        }
        return left.groupKey.localeCompare(right.groupKey, "ru");
      });

      const groupedIds = groups.map((group) => group.ids);
      childGroupsMemo.set(nodeId, groupedIds);
      return groupedIds;
    };

    const getSubtreeWidthTopDownVertical = (nodeId: string): number => {
      if (subtreeWidthMemoVertical.has(nodeId)) {
        return subtreeWidthMemoVertical.get(nodeId) as number;
      }

      const childGroups = getChildGroupsByPosition(nodeId);
      if (childGroups.length === 0) {
        subtreeWidthMemoVertical.set(nodeId, NODE_WIDTH);
        return NODE_WIDTH;
      }

      const groupWidths = childGroups.map((group) => {
        const maxItemWidth = group.reduce(
          (maxWidth, childId) => Math.max(maxWidth, getSubtreeWidthTopDownVertical(childId)),
          NODE_WIDTH
        );
        if (group.length > 1) {
          return maxItemWidth + POSITION_MODE_STACK_INDENT;
        }
        return maxItemWidth;
      });

      const totalChildrenWidth =
        groupWidths.reduce((sum, width) => sum + width, 0) +
        (groupWidths.length - 1) * POSITION_MODE_HORIZONTAL_GAP;
      const width = Math.max(NODE_WIDTH, totalChildrenWidth);
      subtreeWidthMemoVertical.set(nodeId, width);
      return width;
    };

    const getSubtreeHeightTopDownVertical = (nodeId: string): number => {
      if (subtreeHeightMemoVertical.has(nodeId)) {
        return subtreeHeightMemoVertical.get(nodeId) as number;
      }

      const childrenHeight = getChildGroupsTotalHeight(nodeId);
      const height = childrenHeight === 0
        ? NODE_HEIGHT
        : NODE_HEIGHT + POSITION_MODE_VERTICAL_GAP + childrenHeight;
      subtreeHeightMemoVertical.set(nodeId, height);
      return height;
    };

    const childGroupsTotalHeightMemo = new Map<string, number>();
    function getChildGroupsTotalHeight(nodeId: string): number {
      if (childGroupsTotalHeightMemo.has(nodeId)) {
        return childGroupsTotalHeightMemo.get(nodeId) as number;
      }
      const childGroups = getChildGroupsByPosition(nodeId);
      if (childGroups.length === 0) {
        childGroupsTotalHeightMemo.set(nodeId, 0);
        return 0;
      }

      const groupHeights = childGroups.map((group) => {
        if (group.length === 1) {
          return getSubtreeHeightTopDownVertical(group[0]);
        }
        const stackHeight = group.length * NODE_HEIGHT + (group.length - 1) * POSITION_MODE_STACK_GAP;
        let subtreesHeight = 0;
        for (const childId of group) {
          const childSubtreeHeight = getChildGroupsTotalHeight(childId);
          if (childSubtreeHeight > 0) {
            subtreesHeight += POSITION_MODE_VERTICAL_GAP + childSubtreeHeight;
          }
        }
        return stackHeight + subtreesHeight;
      });

      const total = Math.max(...groupHeights, 0);
      childGroupsTotalHeightMemo.set(nodeId, total);
      return total;
    }

    const placeChildGroupsTopDownVertical = (
      parentNodeId: string,
      parentLeftX: number,
      parentNodeWidth: number,
      topY: number,
      depth: number
    ): number => {
      const childGroups = getChildGroupsByPosition(parentNodeId);
      if (childGroups.length === 0) {
        return topY;
      }

      const groupWidths = childGroups.map((group) => {
        const maxItemWidth = group.reduce(
          (maxWidth, childId) => Math.max(maxWidth, getSubtreeWidthTopDownVertical(childId)),
          NODE_WIDTH
        );
        if (group.length > 1) {
          return maxItemWidth + POSITION_MODE_STACK_INDENT;
        }
        return maxItemWidth;
      });
      const totalChildrenWidth =
        groupWidths.reduce((sum, width) => sum + width, 0) +
        (groupWidths.length - 1) * POSITION_MODE_HORIZONTAL_GAP;

      let groupLeftX = parentLeftX + (parentNodeWidth - totalChildrenWidth) / 2;
      let maxBottom = topY;

      for (let groupIndex = 0; groupIndex < childGroups.length; groupIndex += 1) {
        const group = childGroups[groupIndex];
        const groupWidth = groupWidths[groupIndex];

        if (group.length === 1) {
          const childId = group[0];
          const childWidth = getSubtreeWidthTopDownVertical(childId);
          const childLeftX = groupLeftX + (groupWidth - childWidth) / 2;
          placeTopDownVertical(childId, childLeftX, topY, depth);
          maxBottom = Math.max(maxBottom, topY + getSubtreeHeightTopDownVertical(childId));
        } else {
          const innerLeftX = groupLeftX + POSITION_MODE_STACK_INDENT;
          const innerWidth = groupWidth - POSITION_MODE_STACK_INDENT;
          let y = topY;
          for (const childId of group) {
            positionByNodeId.set(childId, { x: innerLeftX, y });
            depthByNodeId.set(childId, depth);
            y += NODE_HEIGHT + POSITION_MODE_STACK_GAP;
          }
          y -= POSITION_MODE_STACK_GAP;

          for (const childId of group) {
            if (getChildGroupsTotalHeight(childId) === 0) continue;
            y += POSITION_MODE_VERTICAL_GAP;
            y = placeChildGroupsTopDownVertical(childId, innerLeftX, innerWidth, y, depth + 1);
          }

          maxBottom = Math.max(maxBottom, y);
        }

        groupLeftX += groupWidth + POSITION_MODE_HORIZONTAL_GAP;
      }

      return maxBottom;
    };

    const placeTopDownVertical = (nodeId: string, leftX: number, topY: number, depth: number) => {
      const nodeWidth = getSubtreeWidthTopDownVertical(nodeId);
      const nodeX = leftX + (nodeWidth - NODE_WIDTH) / 2;
      positionByNodeId.set(nodeId, { x: nodeX, y: topY });
      depthByNodeId.set(nodeId, depth);

      const childGroups = getChildGroupsByPosition(nodeId);
      if (childGroups.length === 0) {
        return;
      }

      const childStartY = topY + NODE_HEIGHT + POSITION_MODE_VERTICAL_GAP;
      placeChildGroupsTopDownVertical(nodeId, leftX, nodeWidth, childStartY, depth + 1);
    };

    const totalRootsWidth =
      roots.reduce((sum, rootId) => sum + getSubtreeWidthTopDownVertical(rootId), 0) +
      Math.max(0, roots.length - 1) * ROOT_GAP;
    let rootLeftX = CHART_PADDING;

    if (roots.length > 0 && totalRootsWidth < 1200) {
      rootLeftX += (1200 - totalRootsWidth) / 2;
    }

    for (const rootId of roots) {
      placeTopDownVertical(rootId, rootLeftX, CHART_PADDING, 1);
      rootLeftX += getSubtreeWidthTopDownVertical(rootId) + ROOT_GAP;
    }

    for (const parentNodeId of visibleNodes.map((node) => node.id)) {
      const parentNode = visibleNodeById.get(parentNodeId);
      const parentPosition = positionByNodeId.get(parentNodeId);
      if (!parentNode || Number(parentNode.hierarchy_level || 1) !== 1 || !parentPosition) continue;

      const primaryChildId = getChildGroupsByPosition(parentNodeId)
        .find((group) => group.length === 1 && getChildGroupsByPosition(group[0]).length > 0)?.[0];
      const childPosition = primaryChildId ? positionByNodeId.get(primaryChildId) : null;
      if (!childPosition) continue;

      const delta = (childPosition.x + NODE_WIDTH / 2) - (parentPosition.x + NODE_WIDTH / 2);
      if (Math.abs(delta) > 80) continue;

      const nudge = Math.max(-48, Math.min(48, delta));
      positionByNodeId.set(parentNodeId, { ...parentPosition, x: parentPosition.x + nudge });
    }
  } else {
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
  }

  const graphNodes: Node<OrgNodeData>[] = visibleNodes.map((node) => {
    const palette = getPaletteByLevel(node.hierarchy_level);
    const managerName = node.manager?.full_name || translate("org_structure.not_assigned");
    const managerInitials = node.manager?.initials || "U";
    const managerPhoto = node.manager?.photo || null;

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
        managerPhoto,
        subtitle: buildSubtitle(node),
        borderColor: palette.border,
        backgroundColor: palette.background,
        avatarColor: palette.avatar,
        hasParent: Boolean(node.parent_id && visibleNodeById.has(node.parent_id)),
        hasChildren: (childrenByParent.get(node.id)?.length || 0) > 0,
        showCollapseControl: node.node_kind === "positions",
        isCollapsed: collapsedNodeIds.has(node.id),
        isHighlighted: highlightedNodeIds.has(node.id),
        onAddChild,
        onToggleCollapse,
      },
    };
  });

  const childGroupMetaByNodeId = new Map<
    string,
    {
      isVerticalStack: boolean;
      isFirstInGroup: boolean;
      previousInGroupId: string | null;
    }
  >();
  for (const [, childIds] of visibleChildrenByParent.entries()) {
    const groupsMap = new Map<string, string[]>();
    for (const childId of childIds) {
      const childNode = visibleNodeById.get(childId);
      const groupKey =
        childNode && typeof childNode.department_guid === "string" && childNode.department_guid.trim()
          ? childNode.department_guid.trim()
          : UNASSIGNED_POSITION_KEY;

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, []);
      }
      groupsMap.get(groupKey)?.push(childId);
    }

    for (const ids of groupsMap.values()) {
      ids.sort((leftId, rightId) => {
        const leftTitle = visibleNodeById.get(leftId)?.title || "";
        const rightTitle = visibleNodeById.get(rightId)?.title || "";
        return leftTitle.localeCompare(rightTitle, "ru");
      });

      const isVerticalStack = ids.length > 1;
      for (let index = 0; index < ids.length; index += 1) {
        childGroupMetaByNodeId.set(ids[index], {
          isVerticalStack,
          isFirstInGroup: index === 0,
          previousInGroupId: index > 0 ? ids[index - 1] : null,
        });
      }
    }
  }

  const sharedBusYByParentId = new Map<string, number>();
  for (const [parentId, childIds] of visibleChildrenByParent.entries()) {
    const parentPosition = positionByNodeId.get(parentId);
    if (!parentPosition || childIds.length === 0) {
      continue;
    }

    const directChildIds = childIds.filter((childId) => {
      const groupMeta = childGroupMetaByNodeId.get(childId);
      return !(groupMeta?.isVerticalStack && !groupMeta.isFirstInGroup && groupMeta.previousInGroupId);
    });
    if (directChildIds.length === 0) {
      continue;
    }

    const sourceY = parentPosition.y + NODE_HEIGHT;
    const minTargetY = directChildIds.reduce((minY, childId) => {
      const childPosition = positionByNodeId.get(childId);
      if (!childPosition) return minY;
      return Math.min(minY, childPosition.y);
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(minTargetY)) {
      continue;
    }

    const verticalGap = Math.max(42, Math.min(86, Math.abs(minTargetY - sourceY) * 0.34));
    sharedBusYByParentId.set(parentId, sourceY + verticalGap);
  }

  const graphEdges: Edge[] = visibleNodes
    .filter((node) => node.parent_id && visibleNodeById.has(node.parent_id))
    .map((node) => {
      const groupMeta = childGroupMetaByNodeId.get(node.id);
      const parentId = String(node.parent_id);
      const stackedLinkSourceId =
        groupMeta?.isVerticalStack && !groupMeta.isFirstInGroup && groupMeta.previousInGroupId
          ? groupMeta.previousInGroupId
          : null;
      const sourceId = stackedLinkSourceId || parentId;
      const targetId = node.id;
      const isInnerStackEdge = Boolean(stackedLinkSourceId);
      const isVerticalStackEdge = Boolean(groupMeta?.isVerticalStack);

      let sourceHandle = "source-bottom";
      let targetHandle = "target-top";
      if (isInnerStackEdge) {
        sourceHandle = "source-left";
        targetHandle = "target-left";
      } else if (isVerticalStackEdge) {
        sourceHandle = "source-bottom";
        targetHandle = "target-left";
      }

      const sharedBusY = !isInnerStackEdge ? sharedBusYByParentId.get(parentId) : undefined;

      return {
        id: `edge:${sourceId}:${targetId}`,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
        type: "org",
        animated: false,
        zIndex: 0,
        style: {
          stroke: "#CBD5E1",
          strokeWidth: 1.5,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        data: sharedBusY !== undefined ? ({ sharedBusY } satisfies OrgEdgeData) : undefined,
      };
    });

  const maxDepth =
    Math.max(...Array.from(depthByNodeId.values()), 1);

  return {
    graphNodes,
    graphEdges,
    maxDepth,
  };
};

interface OrganizationStructureModuleProps {
  embedded?: boolean;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  filtersOpen?: boolean;
  onActiveFiltersCountChange?: (count: number) => void;
  createRequestKey?: number;
}

function OrganizationStructureModule({ embedded = false,
  searchValue,
  onSearchValueChange,
  filtersOpen = false,
  onActiveFiltersCountChange,
  createRequestKey,
}: OrganizationStructureModuleProps) {
  const { t } = useTranslation();
  const [internalSearchInput, setInternalSearchInput] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedHierarchyLevel, setSelectedHierarchyLevel] = useState("");
  const [structureViewMode] = useState<StructureViewMode>("positions");
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [departmentTitle, setDepartmentTitle] = useState("");
  const [parentDepartmentId, setParentDepartmentId] = useState("");
  const [leaderUserId, setLeaderUserId] = useState("");
  const selectPortalTarget = typeof document !== "undefined" ? document.body : null;
  const searchInput = typeof searchValue === "string" ? searchValue : internalSearchInput;
  const setSearchInput = (value: string) => {
    if (onSearchValueChange) {
      onSearchValueChange(value);
      return;
    }
    setInternalSearchInput(value);
  };

  const requestData = useMemo(() => {
    const payload: Record<string, unknown> = {};

    const companyGuid =
      companyStore.company?.guid && typeof companyStore.company.guid === "string"
        ? companyStore.company.guid
        : "";

    if (companyGuid) {
      payload.companies_id = companyGuid;
    }

    if (structureViewMode === "departments" && selectedDepartmentId) {
      payload.department_id = selectedDepartmentId;
    }

    if (structureViewMode === "departments" && selectedHierarchyLevel) {
      payload.hierarchy_level = Number(selectedHierarchyLevel);
    }

    return payload;
  }, [structureViewMode, selectedDepartmentId, selectedHierarchyLevel, companyStore.company?.guid]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useOrgStructureReportQuery(requestData);
  const createDepartmentMutation = useCreateDepartment();
  const updateDepartmentMutation = useUpdateDepartment();
  const deleteDepartmentMutation = useDeleteDepartment();
  const isEmployeesLoading = false;

  const result = data?.result;
  const departmentChartNodes = (result?.chart?.nodes || []) as OrgStructureDisplayNode[];
  const filterDepartments = result?.filters?.departments || [];
  const filterLevels = result?.filters?.levels || [];
  const departmentOptions = useMemo<DepartmentTreeOption[]>(
    () =>
      filterDepartments.map((department) => ({
        value: department.guid,
        label: department.title,
        hierarchyLevel: Number(department.hierarchy_level || 1),
        parentId: department.parent_id,
      })),
    [filterDepartments]
  );
  const levelOptions = useMemo<LevelFilterOption[]>(
    () =>
      filterLevels.map((level) => ({
        value: String(level.value),
        label: level.label,
        hierarchyLevel: Number(level.value || 1),
      })),
    [filterLevels]
  );
  const selectedDepartmentOption = useMemo(
    () => departmentOptions.find((option) => option.value === selectedDepartmentId) || null,
    [departmentOptions, selectedDepartmentId]
  );
  const selectedLevelOption = useMemo(
    () => levelOptions.find((option) => option.value === selectedHierarchyLevel) || null,
    [levelOptions, selectedHierarchyLevel]
  );
  const chartNodes = useMemo(
    () =>
      structureViewMode === "positions"
        ? (((result?.chart?.nodes || []) as OrgStructureDisplayNode[]).map((node) => ({
            ...node,
            node_kind: "positions",
          })))
        : departmentChartNodes,
    [departmentChartNodes, result?.chart?.nodes, structureViewMode]
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
  const collapsedNodeIdSet = useMemo(() => new Set(collapsedNodeIds), [collapsedNodeIds]);
  const toggleNodeCollapse = useCallback((nodeId: string) => {
    setCollapsedNodeIds((previous) =>
      previous.includes(nodeId)
        ? previous.filter((id) => id !== nodeId)
        : [...previous, nodeId]
    );
  }, []);
  useEffect(() => {
    setCollapsedNodeIds((previous) => previous.filter((id) => nodeById.has(id)));
  }, [nodeById]);
  const settingsDepartments = useMemo<Department[]>(
    () => [],
    []
  );
  const departmentsById = useMemo(
    () => new Map(settingsDepartments.map((department) => [department.guid, department])),
    [settingsDepartments]
  );

  const departmentLevels = useMemo(() => {
    const levels = new Map<string, number>();
    const allIds = new Set(settingsDepartments.map((dep) => dep.guid));
    const map = new Map<string, Department[]>();

    for (const dep of settingsDepartments) {
      const parentKey =
        dep.departments_id && allIds.has(dep.departments_id) ? dep.departments_id : ROOT_KEY;
      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }
      map.get(parentKey)?.push(dep);
    }

    const walk = (parentKey: string, level: number) => {
      const children = map.get(parentKey) || [];
      for (const child of children) {
        levels.set(child.guid, level);
        walk(child.guid, level + 1);
      }
    };

    walk(ROOT_KEY, 0);
    return levels;
  }, [settingsDepartments]);

  const forbiddenParentIds = useMemo(() => {
    if (!editingDepartment) return new Set<string>();

    const blocked = new Set<string>([editingDepartment.guid]);
    const queue = [editingDepartment.guid];
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;

      for (const dep of settingsDepartments) {
        if (dep.departments_id === currentId && !blocked.has(dep.guid)) {
          blocked.add(dep.guid);
          queue.push(dep.guid);
        }
      }
    }

    return blocked;
  }, [settingsDepartments, editingDepartment]);

  const parentOptions = useMemo<Option[]>(() => {
    const options: Option[] = [{ value: "", label: t("org_structure.no_parent") }];
    const allowed = settingsDepartments
      .filter((dep) => !forbiddenParentIds.has(dep.guid))
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));

    for (const dep of allowed) {
      const level = departmentLevels.get(dep.guid) || 0;
      const prefix = level > 0 ? `${"|- ".repeat(Math.min(level, 4))}` : "";
      options.push({ value: dep.guid, label: `${prefix}${String(dep.title || t("org_structure.untitled"))}` });
    }

    return options;
  }, [departmentLevels, settingsDepartments, forbiddenParentIds]);

  const openCreateChildDepartmentModal = useCallback((nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) return;

    const parentGuid = String(node.department_guid || node.id || "").trim();
    if (!parentGuid) return;

    setEditingDepartment(null);
    setDepartmentTitle("");
    setParentDepartmentId(parentGuid);
    setLeaderUserId("");
    setIsUpsertModalOpen(true);
  }, [nodeById]);

  const layout = useMemo(
    () =>
      buildHierarchyLayout(
        chartNodes,
        highlightedNodeIds,
        structureViewMode === "departments" ? openCreateChildDepartmentModal : undefined,
        structureViewMode === "positions" ? "topDownVerticalChildren" : "topDown",
        collapsedNodeIdSet,
        toggleNodeCollapse
      ),
    [
      chartNodes,
      collapsedNodeIdSet,
      highlightedNodeIds,
      openCreateChildDepartmentModal,
      structureViewMode,
      toggleNodeCollapse,
    ]
  );
  const highlightedGraphNodes = useMemo(
    () => layout.graphNodes.filter((node) => highlightedNodeIds.has(node.id)),
    [highlightedNodeIds, layout.graphNodes]
  );
  useEffect(() => {
    if (!selectedNodeId) return;
    const isVisible = layout.graphNodes.some((node) => node.id === selectedNodeId);
    if (!isVisible) {
      setSelectedNodeId(null);
    }
  }, [layout.graphNodes, selectedNodeId]);
  const activeFiltersCount =
    structureViewMode === "departments"
      ? [selectedDepartmentId, selectedHierarchyLevel].filter(Boolean).length
      : 0;

  useEffect(() => {
    onActiveFiltersCountChange?.(activeFiltersCount);
  }, [activeFiltersCount, onActiveFiltersCountChange]);

  useEffect(() => {
    if (!embedded) return;
    if (!createRequestKey) return;

    setEditingDepartment(null);
    setDepartmentTitle("");
    setParentDepartmentId("");
    setLeaderUserId("");
    setIsUpsertModalOpen(true);
  }, [createRequestKey, embedded]);

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

  const isPositionsMode = structureViewMode === "positions";
  const moduleLoading = isLoading;

  const nodeTypes = useMemo(() => ({ orgNode: OrgNodeCard }), []);
  const onNodeClick = useMemo<NodeMouseHandler<OrgNodeData>>(
    () => (_event, node) => {
      setSelectedNodeId(node.id);
      setEmployeeSearch("");
    },
    []
  );

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) || null : null;
  const selectedNodeDepartment = useMemo(() => {
    if (!selectedNode || structureViewMode !== "departments") return null;
    const key = selectedNode.department_guid || selectedNode.id;
    return departmentsById.get(key) || null;
  }, [departmentsById, selectedNode, structureViewMode]);
  const selectedEmployees = useMemo<Employee[]>(() => [], []);

  const openEditModal = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentTitle(String(department.title || ""));
    setParentDepartmentId(department.departments_id || "");
    setLeaderUserId(department.user_base_id || "");
    setIsUpsertModalOpen(true);
  };

  const closeUpsertModal = () => {
    if (createDepartmentMutation.isLoading || updateDepartmentMutation.isLoading) {
      return;
    }
    setIsUpsertModalOpen(false);
    setEditingDepartment(null);
    setDepartmentTitle("");
    setParentDepartmentId("");
    setLeaderUserId("");
  };

  const openDeleteModal = (department: Department) => {
    setDepartmentToDelete(department);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteDepartmentMutation.isLoading) return;
    setDepartmentToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const handleSubmitDepartment = async () => {
    const title = departmentTitle.trim();
    if (!title) {
      toast.error(t("org_structure.department_title_required"));
      return;
    }

    const payload = {
      title,
      departments_id: parentDepartmentId || null,
      user_base_id: leaderUserId || null,
    };

    try {
      if (editingDepartment) {
        await updateDepartmentMutation.mutateAsync({
          guid: editingDepartment.guid,
          data: payload,
        });
      } else {
        await createDepartmentMutation.mutateAsync(payload);
      }

      toast.success(editingDepartment ? t("org_structure.department_updated") : t("org_structure.department_created"));
      closeUpsertModal();
      setSelectedNodeId(null);
      void refetch();
    } catch (submitError) {
      console.error("Failed to save department from org structure:", submitError);
      toast.error(editingDepartment ? t("org_structure.department_update_error") : t("org_structure.department_create_error"));
    }
  };

  const handleDeleteDepartment = async () => {
    if (!departmentToDelete) return;
    try {
      await deleteDepartmentMutation.mutateAsync(departmentToDelete.guid);
      toast.success(t("org_structure.department_deleted"));
      closeDeleteModal();
      setSelectedNodeId(null);
      void refetch();
    } catch (deleteError) {
      console.error("Failed to delete department from org structure:", deleteError);
      toast.error(t("org_structure.department_delete_error"));
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setSelectedDepartmentId("");
    setSelectedHierarchyLevel("");
  };

  useEffect(() => {
    setSelectedNodeId(null);
    setEmployeeSearch("");
    setCollapsedNodeIds([]);
    if (structureViewMode === "positions") {
      setSelectedDepartmentId("");
      setSelectedHierarchyLevel("");
    }
  }, [structureViewMode]);

  const graphContent = (
    // Схема всегда занимает высоту родителя: и встроенная в «Сотрудники», и
    // отдельная страница дают ей ограниченный по высоте контейнер.
    <div className="relative h-full">
      {isFetching ? (
        <div className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs font-medium text-gray-600 shadow-sm">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
          {t("org_structure.updating")}
        </div>
      ) : null}

      {layout.graphNodes.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">
          {t("org_structure.no_data_filters")}
        </div>
      ) : (
        <div className="h-full">
          <ReactFlow
            nodes={layout.graphNodes}
            edges={layout.graphEdges}
            nodeTypes={nodeTypes}
            edgeTypes={orgEdgeTypes}
            onInit={setFlowInstance}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.1, minZoom: 0.05 }}
            minZoom={0.05}
            maxZoom={2}
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
  );

  if (moduleLoading) {
    if (embedded) {
      return (
        <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      );
    }

    return (
      <>
        <PageMeta title={t("org_structure.page_title")} description={t("org_structure.page_description")} />
        <div className="flex min-h-[340px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    if (embedded) {
      return (
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">{getErrorMessage(error)}</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-error-600 px-4 text-sm font-semibold text-white transition hover:bg-error-700"
          >
            {t("common.retry")}
          </button>
        </div>
      );
    }

    return (
      <>
        <PageMeta title={t("org_structure.page_title")} description={t("org_structure.page_description")} />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">{getErrorMessage(error)}</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-error-600 px-4 text-sm font-semibold text-white transition hover:bg-error-700"
          >
            {t("common.retry")}
          </button>
        </div>
      </>
    );
  }

  const nodeDetailsModal = (
    <Modal
      isOpen={Boolean(selectedNode)}
      onClose={() => setSelectedNodeId(null)}
      className="max-w-[760px] p-5"
    >
      <div className="space-y-4">
        {isPositionsMode && selectedNode?.manager?.guid ? (
          <>
            <div className="flex items-start gap-4 pr-10">
              {selectedNode.manager.photo ? (
                <img
                  src={selectedNode.manager.photo}
                  alt={selectedNode.manager.full_name}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-lg font-semibold text-brand-600">
                  {selectedNode.manager.initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold text-slate-900">
                  {selectedNode.manager.full_name || selectedNode.title || t("org_structure.employee")}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {selectedNode.manager.position_title || t("org_structure.no_position")}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Email</span>
                  <span className="truncate font-medium text-slate-800">{selectedNode.manager.email || t("org_structure.not_specified")}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">{t("org_structure.phone")}</span>
                  <span className="truncate font-medium text-slate-800">{selectedNode.manager.phone || t("org_structure.not_specified")}</span>
                </div>
              </div>
            </div>

            <Link
              to={`/employees/${selectedNode.manager.guid}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setSelectedNodeId(null)}
            >
              {t("org_structure.open_profile")}
            </Link>
          </>
        ) : (
          <>
            <div className="pr-10">
              <h2 className="text-xl font-semibold text-slate-900">
                {isPositionsMode
                  ? selectedNode?.title || t("org_structure.position")
                  : selectedNode?.manager?.full_name || t("org_structure.manager")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isPositionsMode
                  ? selectedNode?.manager?.guid
                    ? `${selectedNode?.manager?.position_title || t("org_structure.no_position")}`
                    : t("org_structure.employees_count", { count: Number(selectedNode?.direct_employees_count || 0) })
                  : `${selectedNode?.manager?.position_title || t("org_structure.manager")} • ${selectedNode?.title || t("org_structure.department")}`}
              </p>
              {selectedNodeDepartment && !isPositionsMode ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedNodeDepartment)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil size={13} />
                    {t("common.edit_action")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteModal(selectedNodeDepartment)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                  >
                    <Trash2 size={13} />
                    {t("common.delete")}
                  </button>
                </div>
              ) : null}
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
                placeholder={t("org_structure.search_employee")}
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
                  {t("org_structure.employees_not_found")}
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
                        {t("org_structure.profile")}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );

  const upsertModal = (
    <DepartmentUpsertModal
      isOpen={isUpsertModalOpen}
      isSaving={
        createDepartmentMutation.isLoading ||
        updateDepartmentMutation.isLoading
      }
      isEditing={Boolean(editingDepartment)}
      departmentTitle={departmentTitle}
      parentDepartmentId={parentDepartmentId}
      leaderUserId={leaderUserId}
      leaderFallbackLabel={editingDepartment ? resolveDepartmentLeaderName(editingDepartment) : ""}
      parentOptions={parentOptions}
      onClose={closeUpsertModal}
      onDepartmentTitleChange={setDepartmentTitle}
      onParentDepartmentChange={setParentDepartmentId}
      onLeaderChange={setLeaderUserId}
      onSubmit={() => {
        void handleSubmitDepartment();
      }}
    />
  );

  const deleteModal = (
    <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} className="mx-4 w-full max-w-md p-5">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t("org_structure.delete_department_title")}</h3>
          <p className="mt-2 text-sm text-slate-500">
            {t("org_structure.delete_department_prefix")} <span className="font-semibold text-slate-700">{departmentToDelete?.title || "—"}</span>{" "}
            {t("org_structure.delete_department_suffix")}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDeleteModal}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            disabled={deleteDepartmentMutation.isLoading}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleDeleteDepartment();
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={deleteDepartmentMutation.isLoading}
          >
            {deleteDepartmentMutation.isLoading ? t("org_structure.deleting") : t("common.delete")}
          </button>
        </div>
      </div>
    </Modal>
  );

  if (embedded) {
    return (
      <>
        <section className="h-full min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {filtersOpen ? (
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
            {structureViewMode === "departments" ? (
              <>
                <div className="min-w-[230px] flex-1 md:flex-none">
                  <Select<DepartmentTreeOption, false>
                    options={departmentOptions}
                    value={selectedDepartmentOption}
                    onChange={(option: SingleValue<DepartmentTreeOption>) =>
                      setSelectedDepartmentId(option?.value || "")
                    }
                    placeholder={t("org_structure.all_departments")}
                    isSearchable
                    isClearable
                    styles={getFilterSelectStyles<DepartmentTreeOption>()}
                    menuPortalTarget={selectPortalTarget}
                    menuPosition="fixed"
                    noOptionsMessage={() => t("org_structure.departments_not_found")}
                  />
                </div>

                <div className="min-w-[210px] flex-1 md:flex-none">
                  <Select<LevelFilterOption, false>
                    options={levelOptions}
                    value={selectedLevelOption}
                    onChange={(option: SingleValue<LevelFilterOption>) =>
                      setSelectedHierarchyLevel(option?.value || "")
                    }
                    placeholder={t("org_structure.all_levels")}
                    isSearchable={false}
                    isClearable
                    styles={getFilterSelectStyles<LevelFilterOption>()}
                    menuPortalTarget={selectPortalTarget}
                    menuPosition="fixed"
                    noOptionsMessage={() => t("org_structure.levels_not_found")}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm font-medium text-slate-500">
                {t("org_structure.employees_mode_filters_note")}
              </p>
            )}

            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              {t("common.reset")}
            </button>
          </div>
        </div>
      ) : null}

      {graphContent}
    </section>
    {nodeDetailsModal}
    {upsertModal}
    {deleteModal}
  </>
);
  }

  return (
<>
  <PageMeta title={t("org_structure.page_title")} description={t("org_structure.page_description")} />

  {/* ── Toolbar ─────────────────────────────────────────────────────── */}
  {/* Тот же тулбар, что у задач и табеля: страница жила со своей шапкой
      («Назад» + заголовок + подзаголовок), хотя заголовок уже есть в
      хлебных крошках, а фильтры выглядели иначе, чем на остальных
      страницах. */}
  <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-2.5 lg:px-6"
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e2e8f0",
        borderTop: "none",
      }}
    >
          {structureViewMode === "departments" ? (
            <>
              <div className="min-w-[230px] flex-1 md:flex-none">
                <Select<DepartmentTreeOption, false>
                  options={departmentOptions}
                  value={selectedDepartmentOption}
                  onChange={(option: SingleValue<DepartmentTreeOption>) =>
                    setSelectedDepartmentId(option?.value || "")
                  }
                  placeholder={t("org_structure.all_departments")}
                  isSearchable
                  isClearable
                  styles={getFilterSelectStyles<DepartmentTreeOption>()}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                  noOptionsMessage={() => t("org_structure.departments_not_found")}
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
                      placeholder={t("org_structure.all_levels")}
                      isSearchable={false}
                      isClearable
                      styles={getFilterSelectStyles<LevelFilterOption>()}
                      menuPortalTarget={selectPortalTarget}
                      menuPosition="fixed"
                      noOptionsMessage={() => t("org_structure.levels_not_found")}
                    />
                  </div>
                </>
              ) : null}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ExpandableSearchInput
              value={searchInput}
              onChange={setSearchInput}
              inputId="org-structure-search"
              placeholder={
                structureViewMode === "positions" ? t("org_structure.search_position") : t("org_structure.search_department")
              }
              expandedWidth={300}
              collapsedSize={40}
              brandColor={companyStore.mainColor}
            />

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t("common.reset")}
            </button>
          </div>
        </div>
      </div>

      {/* Схема занимает весь оставшийся экран и скроллится внутри себя:
          страница не должна вытягиваться под высоту дерева — иначе на большой
          компании до низа графа приходится листать всю страницу, а панорама и
          зум внутри ReactFlow становятся бесполезны.
          6.5rem = шапка приложения (4rem) + вертикальные отступы контента. */}
      <div className="mt-4 h-[calc(100vh-6.5rem)] min-h-[420px]">
        <section className="h-full min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="h-full min-h-0">{graphContent}</div>
        </section>
      </div>

      {nodeDetailsModal}
      {upsertModal}
      {deleteModal}
    </>
  );
}

export default observer(OrganizationStructureModule);
