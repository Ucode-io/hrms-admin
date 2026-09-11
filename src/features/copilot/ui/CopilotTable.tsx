import { Download } from "lucide-react";
import type { CopilotTable as CopilotTableModel } from "../types";

/**
 * Saves a result as CSV.
 *
 * Semicolons and a BOM because the file exists to be opened in Excel: a
 * comma-separated UTF-8 file without them lands in a Russian Excel as one
 * column of mojibake, which reads as a broken export rather than a locale.
 */
const downloadCsv = (table: CopilotTableModel): void => {
  const escape = (value: string | number | null): string => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const csv = [
    table.columns.map((c) => escape(c.label)),
    ...table.rows.map((row) => table.columns.map((c) => escape(row[c.key]))),
  ]
    .map((cells) => cells.join(";"))
    .join("\r\n");

  const url = URL.createObjectURL(
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${table.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * A result set rendered as a table.
 *
 * This exists so the assistant never has to retype rows into prose: the values
 * shown here came from the query, so a name or a date on screen is exactly what
 * the database holds.
 */
const CopilotTableView: React.FC<{ table: CopilotTableModel }> = ({ table }) => {
  if (table.rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
        {table.title}: ничего не найдено.
      </div>
    );
  }

  const hidden =
    table.totalCount !== undefined && table.totalCount > table.rows.length
      ? table.totalCount - table.rows.length
      : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-start gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {table.title}
            {table.totalCount !== undefined && (
              <span className="ml-1 text-gray-400">· {table.totalCount}</span>
            )}
          </p>
          {table.subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{table.subtitle}</p>
          )}
        </div>
        {/* ponytail: exports the rows on screen, which is what the card shows
            and says. A full export of a truncated result needs the query run
            again server-side — add it when someone asks for more than 50. */}
        <button
          type="button"
          onClick={() => downloadCsv(table)}
          title="Скачать CSV"
          aria-label="Скачать CSV"
          className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
        >
          <Download size={15} />
        </button>
      </div>

      {/* Wide results scroll inside the card so the dock itself never does.
          w-max lets the columns take the width their content needs; w-full
          squeezed them until the last one was clipped with nothing to say it
          was there. copilot-scroll-x paints an edge shadow while there is more
          to scroll to, which is the only cue that sideways scrolling exists. */}
      <div className="copilot-scroll-x max-h-80 overflow-auto">
        <table className="w-max min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  className="whitespace-nowrap px-3 py-2 font-medium text-gray-600 dark:text-gray-300"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr
                key={index}
                className="border-t border-gray-100 dark:border-gray-800"
              >
                {table.columns.map((column) => (
                  <td
                    key={column.key}
                    className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-200"
                  >
                    {row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Показаны первые {table.rows.length} из {table.totalCount}. Уточните
          запрос, чтобы сузить выборку.
        </p>
      )}
    </div>
  );
};

export default CopilotTableView;
