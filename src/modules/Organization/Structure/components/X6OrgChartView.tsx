import { useEffect, useRef } from "react";
import { Graph, Shape } from "@antv/x6";

export type OrgChartCardNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  managerName: string;
  managerInitials: string;
  subtitle: string;
  borderColor: string;
  backgroundColor: string;
  avatarColor: string;
  isHighlighted: boolean;
};

export type OrgChartLinkEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type X6OrgChartApi = {
  fitView: (nodeIds?: string[]) => void;
  centerNode: (nodeId: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type X6OrgChartViewProps = {
  nodes: OrgChartCardNode[];
  edges: OrgChartLinkEdge[];
  height: number | string;
  onNodeClick?: (id: string) => void;
  onReady?: (api: X6OrgChartApi | null) => void;
};

const escapeHtml = (value: string): string =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toPortId = (handle?: string): "top" | "left" | "right" | "bottom" => {
  const h = String(handle || "");
  if (h.includes("left")) return "left";
  if (h.includes("right")) return "right";
  if (h.includes("top")) return "top";
  return "bottom";
};

const toDirection = (handle?: string): "top" | "left" | "right" | "bottom" => {
  const p = toPortId(handle);
  return p;
};

const buildNodeHtml = (node: OrgChartCardNode) => {
  const borderColor = node.isHighlighted ? "#f59e0b" : node.borderColor;
  const background = node.isHighlighted ? "#fffbeb" : node.backgroundColor;
  const shadow = node.isHighlighted ? "0 0 0 2px rgba(245, 158, 11, 0.25)" : "0 1px 2px rgba(15, 23, 42, 0.05)";

  return `
    <div style="
      width:${Math.max(0, node.width - 4)}px;
      height:${Math.max(0, node.height - 4)}px;
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
      font-family:inherit;
      overflow:hidden;
    ">
      <div style="
        width:48px;height:48px;border-radius:9999px;
        background:${node.avatarColor};color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-weight:600;font-size:18px;
        margin-bottom:8px;
      ">${escapeHtml(node.managerInitials || "U")}</div>
      <div style="
        font-size:14px;font-weight:600;color:#1e293b;
        text-align:center;line-height:1.2;
        max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      ">${escapeHtml(node.managerName || "Не назначен")}</div>
      <div style="
        font-size:12px;color:#64748b;margin-top:4px;
        text-align:center;line-height:1.2;
        max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      ">${escapeHtml(node.subtitle || "")}</div>
    </div>
  `;
};

export default function X6OrgChartView({
  nodes,
  edges,
  height,
  onNodeClick,
  onReady,
}: X6OrgChartViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const graph = new Graph({
      container,
      autoResize: true,
      interacting: {
        nodeMovable: false,
        edgeMovable: false,
        edgeLabelMovable: false,
        arrowheadMovable: false,
        vertexMovable: false,
      },
      panning: { enabled: true },
      mousewheel: {
        enabled: true,
        minScale: 0.05,
        maxScale: 2,
        zoomAtMousePosition: true,
      },
      grid: {
        visible: true,
        size: 20,
        type: "dot",
        args: {
          color: "#E2E8F0",
        },
      },
      background: {
        color: "#f8fafc66",
      },
      connecting: {
        router: {
          name: "manhattan",
        },
        connector: {
          name: "rounded",
          args: { radius: 8 },
        },
      },
    });

    graphRef.current = graph;

    for (const node of nodes) {
      graph.addNode({
        id: node.id,
        shape: "html",
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        html: () => {
          const wrap = document.createElement("div");
          wrap.style.width = `${node.width}px`;
          wrap.style.height = `${node.height}px`;
          wrap.style.cursor = "pointer";
          wrap.innerHTML = buildNodeHtml(node);
          return wrap;
        },
        ports: {
          groups: {
            top: { position: "top" },
            left: { position: "left" },
            right: { position: "right" },
            bottom: { position: "bottom" },
          },
          items: [
            { id: "top", group: "top" },
            { id: "left", group: "left" },
            { id: "right", group: "right" },
            { id: "bottom", group: "bottom" },
          ],
        },
      });
    }

    for (const edge of edges) {
      graph.addEdge({
        id: edge.id,
        shape: "edge",
        source: {
          cell: edge.source,
          port: toPortId(edge.sourceHandle),
        },
        target: {
          cell: edge.target,
          port: toPortId(edge.targetHandle),
        },
        router: {
          name: "manhattan",
          args: {
            step: 20,
            padding: 18,
            startDirections: [toDirection(edge.sourceHandle)],
            endDirections: [toDirection(edge.targetHandle)],
          },
        },
        connector: {
          name: "rounded",
          args: { radius: 8 },
        },
        attrs: {
          line: {
            stroke: edge.stroke || "#CBD5E1",
            strokeWidth: edge.strokeWidth || 1.4,
            sourceMarker: null,
            targetMarker: null,
          },
        },
        zIndex: -1,
      });
    }

    graph.on("node:click", ({ node }) => {
      onNodeClick?.(String(node.id));
    });

    const api: X6OrgChartApi = {
      fitView: (nodeIds?: string[]) => {
        if (!nodeIds || nodeIds.length === 0) {
          graph.centerContent();
          return;
        }

        const first = graph.getCellById(nodeIds[0]);
        if (first) {
          graph.centerCell(first);
        } else {
          graph.centerContent();
        }
      },
      centerNode: (nodeId: string) => {
        const cell = graph.getCellById(nodeId);
        if (cell) {
          graph.centerCell(cell);
        }
      },
      zoomIn: () => {
        graph.zoom(0.1);
      },
      zoomOut: () => {
        graph.zoom(-0.1);
      },
    };

    onReady?.(api);
    requestAnimationFrame(() => {
      graph.centerContent();
    });

    return () => {
      onReady?.(null);
      graph.dispose();
      graphRef.current = null;
    };
  }, [nodes, edges, onNodeClick, onReady]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
