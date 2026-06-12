import { levelColor, scoreTone, tagColor } from "../types";

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

/** Compact "n/10" badge colored by the score (10-point scale). */
export const ScoreBadge = ({
  score,
  size = "sm",
}: {
  score: number | null;
  size?: "sm" | "md";
}) => {
  if (score === null) {
    return (
      <span
        className={`inline-flex items-center rounded-md bg-gray-100 font-medium text-gray-400 ${
          size === "md" ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]"
        }`}
      >
        —/10
      </span>
    );
  }
  const tone = scoreTone(score);
  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold ${tone.badgeClassName} ${
        size === "md" ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]"
      }`}
    >
      {score}/10
    </span>
  );
};
