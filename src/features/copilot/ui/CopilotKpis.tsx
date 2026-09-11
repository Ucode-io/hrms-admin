import type { CopilotKpi } from "../types";

/** Headline figures above a report's charts, straight from the report gateway. */
const CopilotKpis: React.FC<{ kpis: CopilotKpi[] }> = ({ kpis }) => {
  if (kpis.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]"
          title={kpi.hint}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</p>
          <p className="text-base font-semibold text-gray-800 dark:text-white/90">
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  );
};

export default CopilotKpis;
