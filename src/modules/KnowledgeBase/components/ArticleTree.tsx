// Notion-like left sidebar tree of articles in a folder. Branches with children
// are collapsible; the active article is highlighted. Ancestors of the active
// article start expanded.

import { useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import type { KbArticleNode } from "../types";

interface ArticleTreeProps {
  nodes: KbArticleNode[];
  activeId: string;
  expandedIds: Set<string>;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

const TreeRow: React.FC<{
  node: KbArticleNode;
  depth: number;
  activeId: string;
  expandedIds: Set<string>;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}> = ({ node, depth, activeId, expandedIds, onOpen, onRemove }) => {
  const [open, setOpen] = useState(expandedIds.has(node.id));
  const hasChildren = node.children.length > 0;
  const isActive = node.id === activeId;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors ${
          isActive ? "bg-brand-50 text-brand-600" : "text-gray-700 hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 ${
            hasChildren ? "" : "invisible"
          }`}
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => onOpen(node.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
        >
          <span className="text-base leading-none">{node.icon}</span>
          <span className="truncate">{node.title || "Без названия"}</span>
        </button>
        <button
          type="button"
          title="Удалить страницу"
          onClick={() => onRemove(node.id)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 opacity-0 transition-colors hover:bg-error-50 hover:text-error-600 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {open &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            activeId={activeId}
            expandedIds={expandedIds}
            onOpen={onOpen}
            onRemove={onRemove}
          />
        ))}
    </div>
  );
};

export default function ArticleTree({
  nodes,
  activeId,
  expandedIds,
  onOpen,
  onRemove,
}: ArticleTreeProps) {
  if (nodes.length === 0) {
    return <p className="px-2 py-3 text-sm text-gray-400">Статей пока нет</p>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          activeId={activeId}
          expandedIds={expandedIds}
          onOpen={onOpen}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
