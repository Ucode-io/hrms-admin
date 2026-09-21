import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Search, Settings as SettingsIcon } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { settingsSections, type SettingsItem } from "./index";

const SettingsLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Flatten each section's columns into a single ordered list of items.
  const sections = useMemo(
    () =>
      settingsSections.map((section) => ({
        id: section.id,
        title: section.title,
        items: section.columns.flat(),
      })),
    []
  );

  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const fields = [item.title, ...(item.keywords ?? [])];
          return fields.some((field) => field.toLowerCase().includes(normalizedQuery));
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, normalizedQuery]);

  const isActive = (item: SettingsItem): boolean => {
    if (!item.path) return false;
    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  };

  const hasSelection = location.pathname !== "/settings";

  return (
    <>
      <PageMeta title="Настройки | HRMS" description="Настройки системы" />

      {/* Страница не скроллится целиком: высота — ровно экран минус шапка
          (h-16 = 64px), скролл живёт внутри колонок. Иначе sticky-сайдбар с
          h-[100dvh] начинался на 64px ниже верха окна, и низ его внутреннего
          скролла оказывался за краем экрана — последние пункты не долистать. */}
      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4 -mb-3 md:-mb-4 flex h-[calc(100dvh-64px)]">
        {/* Settings sidebar */}
        <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-gray-200 bg-white">
          {/* <div className="border-b border-gray-100 px-4 py-3.5">
            <h2 className="m-0 text-[15px] font-semibold text-gray-900">Настройки</h2>
          </div> */}
          <div className="border-b border-gray-100 px-3 py-2.5">
            <label className="relative block">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск..."
                className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {visibleSections.map((section) => (
              <div key={section.id} className="mb-3">
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const clickable = Boolean(item.path);
                    const active = isActive(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!clickable}
                        onClick={() => item.path && navigate(item.path)}
                        title={item.subtitle}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                          active
                            ? "bg-brand-50 text-brand-700"
                            : clickable
                              ? "text-gray-700 hover:bg-gray-50"
                              : "cursor-not-allowed text-gray-400"
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                            active
                              ? "border-brand-200 bg-white text-brand-600"
                              : clickable
                                ? "border-gray-200 bg-gray-50 text-gray-500"
                                : "border-gray-200 bg-gray-100 text-gray-400"
                          }`}
                        >
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                        {!clickable && (
                          <span className="shrink-0 rounded-full border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                            Скоро
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {visibleSections.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-gray-500">Ничего не найдено</p>
            )}
          </nav>
        </aside>

        {/* Selected setting */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {hasSelection ? (
            <div className="px-4 py-4 lg:px-6 lg:py-5">
              <Outlet />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <SettingsIcon size={26} />
              </span>
              <p className="m-0 text-base font-medium text-gray-700">Выберите раздел настроек</p>
              <p className="m-0 max-w-sm text-sm text-gray-500">
                Слева — список разделов. Выберите нужный, чтобы открыть его настройки здесь.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SettingsLayout;
