export type SummaryItem = {
  label: string;
  value: string;
  hint?: string;
  color?: string;
};

/** Итоги периода над таблицей и таймлайном — считает их сервер по всей выборке,
 *  а не по текущей странице. */
export default function SummaryCards({ items }: { items: SummaryItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {item.label}
          </div>
          <div
            className="mt-1 text-lg font-bold text-gray-800 dark:text-white/90"
            style={item.color ? { color: item.color } : undefined}
          >
            {item.value}
          </div>
          {item.hint && <div className="mt-0.5 text-xs text-gray-400">{item.hint}</div>}
        </div>
      ))}
    </div>
  );
}
