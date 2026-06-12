import { STAGE_COLOR_CONFIG, type StageDef } from "../types";

/** Stage name with its color dot. Falls back gracefully when the stage is gone. */
export default function StagePill({ stage }: { stage: StageDef | null | undefined }) {
  if (!stage) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">
        —
      </span>
    );
  }
  const config = STAGE_COLOR_CONFIG[stage.color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${config.badgeClassName}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`} />
      {stage.name}
    </span>
  );
}
