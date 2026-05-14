import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
// @ts-expect-error - d3-org-chart has no types shipped
import { OrgChart } from "d3-org-chart";

export interface OrgChartNode {
  id: string;
  parentId: string | null;
  managerName: string;
  managerInitials: string;
  subtitle: string;
  borderColor: string;
  backgroundColor: string;
  avatarColor: string;
  hasChildren: boolean;
  isGhost?: boolean;
}

type OrgChartNodeInternal = OrgChartNode & {
  _highlighted?: boolean;
  _virtual?: boolean;
};

export interface OrgChartHandle {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  setHighlighted: (ids: string[]) => void;
}

interface OrgChartViewProps {
  data: OrgChartNode[];
  onNodeClick?: (id: string) => void;
  highlightedIds?: string[];
  compact?: boolean;
}

const VIRTUAL_ROOT_BASE_ID = "__orgchart_virtual_root__";

const ensureSingleRoot = (input: OrgChartNodeInternal[]): OrgChartNodeInternal[] => {
  const deduped: OrgChartNodeInternal[] = [];
  const ids = new Set<string>();

  for (const item of input) {
    const id = String(item?.id || "").trim();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    deduped.push({ ...item, id });
  }

  const normalized = deduped.map((item) => ({
    ...item,
    parentId:
      item.parentId && ids.has(String(item.parentId))
        ? String(item.parentId)
        : null,
  }));

  const roots = normalized.filter((item) => !item.parentId);
  if (roots.length <= 1) {
    return normalized;
  }

  let virtualRootId = VIRTUAL_ROOT_BASE_ID;
  let suffix = 1;
  while (ids.has(virtualRootId)) {
    virtualRootId = `${VIRTUAL_ROOT_BASE_ID}_${suffix}`;
    suffix += 1;
  }

  const virtualRoot: OrgChartNodeInternal = {
    id: virtualRootId,
    parentId: null,
    managerName: "",
    managerInitials: "",
    subtitle: "",
    borderColor: "transparent",
    backgroundColor: "transparent",
    avatarColor: "transparent",
    hasChildren: true,
    _virtual: true,
    _highlighted: false,
  };

  const connected = normalized.map((item) =>
    item.parentId ? item : { ...item, parentId: virtualRootId }
  );

  return [virtualRoot, ...connected];
};

const renderNodeHtml = (d: { data: OrgChartNodeInternal; width: number; height: number }) => {
  const node = d.data;
  if (node._virtual || node.isGhost) {
    return `<div style="width:1px;height:1px;opacity:0;"></div>`;
  }
  const highlighted = (node as unknown as { _highlighted?: boolean })._highlighted;
  const borderColor = highlighted ? "#f59e0b" : node.borderColor;
  const background = highlighted ? "#fffbeb" : node.backgroundColor;
  const shadow = highlighted ? "0 0 0 2px rgba(245, 158, 11, 0.25)" : "0 1px 2px rgba(15, 23, 42, 0.05)";
  const safeName = String(node.managerName || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeSubtitle = String(node.subtitle || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeInitials = String(node.managerInitials || "U").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `
    <div style="
      width:${d.width - 4}px;
      height:${d.height - 4}px;
      box-sizing:border-box;
      border:2px solid ${borderColor};
      background:${background};
      border-radius:16px;
      box-shadow:${shadow};
      padding:14px 12px;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      font-family:inherit;
      transition:box-shadow .15s ease;
    ">
      <div style="
        width:48px;height:48px;border-radius:9999px;
        background:${node.avatarColor};color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-weight:600;font-size:18px;
        margin-bottom:8px;
      ">${safeInitials}</div>
      <div style="
        font-size:14px;font-weight:600;color:#1e293b;
        text-align:center;line-height:1.2;
        max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      ">${safeName}</div>
      <div style="
        font-size:12px;color:#64748b;margin-top:4px;
        text-align:center;line-height:1.2;
        max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      ">${safeSubtitle}</div>
    </div>
  `;
};

const OrgChartView = forwardRef<OrgChartHandle, OrgChartViewProps>(function OrgChartView(
  { data, onNodeClick, highlightedIds = [], compact = true },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<unknown>(null);
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  useImperativeHandle(ref, () => ({
    fit: () => {
      const chart = chartRef.current as { fit?: () => void } | null;
      chart?.fit?.();
    },
    zoomIn: () => {
      const chart = chartRef.current as { zoomIn?: () => void } | null;
      chart?.zoomIn?.();
    },
    zoomOut: () => {
      const chart = chartRef.current as { zoomOut?: () => void } | null;
      chart?.zoomOut?.();
    },
    expandAll: () => {
      const chart = chartRef.current as { expandAll?: () => void } | null;
      chart?.expandAll?.();
    },
    collapseAll: () => {
      const chart = chartRef.current as { collapseAll?: () => void } | null;
      chart?.collapseAll?.();
    },
    setHighlighted: (ids: string[]) => {
      const chart = chartRef.current as
        | { data?: () => OrgChartNode[]; render?: () => void }
        | null;
      if (!chart?.data || !chart.render) return;
      const current = chart.data();
      if (!Array.isArray(current)) return;
      const set = new Set(ids);
      for (const item of current) {
        (item as unknown as { _highlighted: boolean })._highlighted = set.has(item.id);
      }
      chart.render();
    },
  }));

  const scheduleFit = (chart: unknown) => {
    const safeChart = chart as { fit?: () => void } | null;
    if (!safeChart?.fit) return;
    requestAnimationFrame(() => {
      safeChart.fit?.();
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = new OrgChart();
    chartRef.current = chart;

    const preparedData = ensureSingleRoot(
      data.map((item) => ({ ...item, _highlighted: highlightedIds.includes(item.id) }))
    );

    chart
      .container(containerRef.current)
      .data(preparedData as unknown as Record<string, unknown>[])
      .nodeWidth((d: { data?: OrgChartNodeInternal }) => (d.data?._virtual ? 2 : 240))
      .nodeHeight((d: { data?: OrgChartNodeInternal }) => (d.data?._virtual ? 2 : 130))
      .childrenMargin(() => 60)
      .compactMarginBetween(() => 18)
      .compactMarginPair(() => 60)
      .siblingsMargin(() => 24)
      .neighbourMargin(() => 24)
      .nodeButtonWidth(() => 0)
      .nodeButtonHeight(() => 0)
      .buttonContent(() => "")
      .compact(compact)
      .nodeContent(renderNodeHtml)
      .linkUpdate(function (this: SVGPathElement) {
        const path = this;
        path.setAttribute("stroke", "#94a3b8");
        path.setAttribute("stroke-width", "1.4");
        path.setAttribute("fill", "none");
      })
      .onNodeClick((nodeData: unknown) => {
        const maybeData =
          nodeData && typeof nodeData === "object" && "data" in (nodeData as Record<string, unknown>)
            ? ((nodeData as Record<string, unknown>).data as Record<string, unknown>)
            : nodeData && typeof nodeData === "object"
              ? (nodeData as Record<string, unknown>)
              : null;
        const isGhostNode =
          Boolean(maybeData && (maybeData._virtual || maybeData.isGhost));
        if (isGhostNode) {
          return;
        }

        const id =
          nodeData && typeof nodeData === "object" && "id" in (nodeData as Record<string, unknown>)
            ? String((nodeData as Record<string, unknown>).id)
            : nodeData &&
                typeof nodeData === "object" &&
                "data" in (nodeData as Record<string, unknown>)
              ? String(
                  ((nodeData as Record<string, { id?: string }>).data ?? {}).id ?? ""
                )
              : "";
        if (id && onNodeClickRef.current) {
          onNodeClickRef.current(id);
        }
      })
      .render();
    chart.expandAll().render();
    scheduleFit(chart);

    return () => {
      try {
        const node = containerRef.current;
        if (node) {
          while (node.firstChild) node.removeChild(node.firstChild);
        }
      } catch {
        // ignore cleanup errors
      }
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current as
      | { data?: (d: unknown[]) => unknown; render?: () => void }
      | null;
    if (!chart?.data || !chart.render) return;
    const set = new Set(highlightedIds);
    const annotated = data.map((item) => ({
      ...item,
      _highlighted: set.has(item.id),
    }));
    const prepared = ensureSingleRoot(annotated as OrgChartNodeInternal[]);
    chart.data(prepared as unknown as Record<string, unknown>[]);
    chart.render();
    if (chart.expandAll) {
      chart.expandAll().render();
    }
    scheduleFit(chart);
  }, [data, highlightedIds]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 480,
        background: "#f8fafc",
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
});

export default OrgChartView;
