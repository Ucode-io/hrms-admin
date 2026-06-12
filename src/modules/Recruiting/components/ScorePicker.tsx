import { scoreTone } from "../types";

interface ScorePickerProps {
  /** 1..10 or null when not scored yet. */
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

/**
 * Segmented 1–10 score control. Clicking the active value clears the score.
 */
export default function ScorePicker({ value, onChange, disabled = false }: ScorePickerProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Оценка по 10-балльной шкале">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const isActive = value === n;
        const tone = scoreTone(n);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(isActive ? null : n)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition ${
              isActive
                ? `${tone.barClassName} border-transparent text-white shadow-sm`
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
