import { Star } from "lucide-react";
import { levelColor, tagColor } from "../types";

export const TagChip = ({ tag }: { tag: string }) => {
  if (!tag) return null;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tagColor(
        tag
      )}`}
    >
      {tag}
    </span>
  );
};

export const LevelChip = ({ level }: { level: string }) => {
  if (!level) return null;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${levelColor(
        level
      )}`}
    >
      {level}
    </span>
  );
};

export const RatingStars = ({
  value,
  size = 14,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (value: number) => void;
}) => (
  <div className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <button
        key={i}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(i === value ? 0 : i)}
        className={onChange ? "cursor-pointer" : "cursor-default"}
      >
        <Star
          size={size}
          className={i <= value ? "fill-amber-400 text-amber-400" : "text-gray-300"}
        />
      </button>
    ))}
  </div>
);
