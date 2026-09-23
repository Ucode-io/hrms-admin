import { Icon } from "@iconify/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../i18n";

export type IconOption = {
  value: string;
  label: string;
};

// Подписи по-английски: они идут в поиск и aria-label, а удалённый поиск Iconify тоже английский.
export const DEFAULT_ICON_OPTIONS: IconOption[] = [
  { value: "mdi:calendar-month-outline", label: "Calendar" },
  { value: "mdi:umbrella-outline", label: "Vacation" },
  { value: "mdi:heart-pulse", label: "Sick leave" },
  { value: "mdi:account-cancel-outline", label: "Absence" },
  { value: "mdi:account-check-outline", label: "Presence" },
  { value: "mdi:home-outline", label: "Home" },
  { value: "mdi:briefcase-outline", label: "Work" },
  { value: "mdi:map-marker-outline", label: "Location" },
  { value: "mdi:clock-outline", label: "Time" },
  { value: "mdi:star-outline", label: "Favorite" },
  { value: "mdi:heart-outline", label: "Care" },
  { value: "mdi:white-balance-sunny", label: "Day" },
  { value: "mdi:moon-waning-crescent", label: "Night" },
  { value: "mdi:coffee-outline", label: "Break" },
  { value: "mdi:earth", label: "Business trip" },
  { value: "mdi:airplane", label: "Travel" },
  { value: "mdi:monitor", label: "Remote" },
  { value: "mdi:book-open-variant-outline", label: "Training" },
  { value: "mdi:file-document-outline", label: "Document" },
  { value: "mdi:shield-check-outline", label: "Security" },
  { value: "mdi:tag-outline", label: "Tag" },
  { value: "mdi:trophy-outline", label: "Award" },
  { value: "mdi:chart-pie-outline", label: "Statistics" },
  { value: "mdi:account-group-outline", label: "Team" },
  { value: "mdi:flash-outline", label: "Urgent" },
  { value: "tabler:vacuum-cleaner", label: "Service" },
  { value: "tabler:sun", label: "Sun" },
  { value: "tabler:moon-stars", label: "Night sky" },
  { value: "tabler:building-community", label: "Office" },
  { value: "tabler:plane-inflight", label: "Flight" },
  { value: "tabler:stethoscope", label: "Medicine" },
  { value: "tabler:device-laptop", label: "Laptop" },
  { value: "tabler:clock-hour-8", label: "Shift" },
  { value: "solar:shield-check-linear", label: "Protection" },
  { value: "solar:flag-2-linear", label: "Flag" },
  { value: "solar:archive-linear", label: "Archive" },
  { value: "solar:users-group-two-rounded-linear", label: "People" },
  { value: "solar:calendar-mark-linear", label: "Plan" },
  { value: "solar:map-point-linear", label: "Point" },
  { value: "solar:documents-minimalistic-linear", label: "Documents" },
];

const LEGACY_ICON_VALUE_MAP: Record<string, string> = {
  calendar: "mdi:calendar-month-outline",
  plane: "mdi:airplane",
  medical: "mdi:heart-pulse",
  personal: "mdi:account-cancel-outline",
  remote: "mdi:monitor",
  "business-trip": "mdi:earth",
  training: "mdi:book-open-variant-outline",
  document: "mdi:file-document-outline",
  "night-shift": "mdi:moon-waning-crescent",
  "day-shift": "mdi:white-balance-sunny",
  security: "mdi:shield-check-outline",
  dismissal: "mdi:account-cancel-outline",
  tagged: "mdi:tag-outline",
  "coffee-break": "mdi:coffee-outline",
  FiCalendar: "mdi:calendar-month-outline",
  FiUmbrella: "mdi:umbrella-outline",
  FiActivity: "mdi:heart-pulse",
  FiUserX: "mdi:account-cancel-outline",
  FiUserCheck: "mdi:account-check-outline",
  FiHome: "mdi:home-outline",
  FiBriefcase: "mdi:briefcase-outline",
  FiMapPin: "mdi:map-marker-outline",
  FiClock: "mdi:clock-outline",
  FiStar: "mdi:star-outline",
  FiHeart: "mdi:heart-outline",
  FiSun: "mdi:white-balance-sunny",
  FiMoon: "mdi:moon-waning-crescent",
  FiCoffee: "mdi:coffee-outline",
  FiGlobe: "mdi:earth",
  FiNavigation: "mdi:airplane",
  FiShoppingBag: "mdi:shopping-outline",
  FiTool: "mdi:tools",
  FiShield: "mdi:shield-check-outline",
  FiAward: "mdi:trophy-outline",
  FiCheckCircle: "mdi:check-circle-outline",
  FiAlertCircle: "mdi:alert-circle-outline",
  FiTag: "mdi:tag-outline",
  FiFlag: "mdi:flag-outline",
  FiBookOpen: "mdi:book-open-variant-outline",
  FiFileText: "mdi:file-document-outline",
  FiArchive: "mdi:archive-outline",
  FiDatabase: "mdi:database-outline",
  FiGrid: "mdi:grid",
  FiLayers: "mdi:layers-outline",
  FiTarget: "mdi:target",
  FiPieChart: "mdi:chart-pie-outline",
  FiUsers: "mdi:account-group-outline",
  FiUser: "mdi:account-outline",
  FiSmile: "mdi:emoticon-outline",
  FiWind: "mdi:weather-windy",
  FiZap: "mdi:flash-outline",
  FiWatch: "mdi:watch-variant",
  FiTruck: "mdi:truck-outline",
  FiLifeBuoy: "mdi:lifebuoy",
  FiBell: "mdi:bell-outline",
  FiPlusCircle: "mdi:plus-circle-outline",
  FiEye: "mdi:eye-outline",
  FiEdit3: "mdi:pencil-outline",
  FiAirplay: "mdi:cast",
  FiRadio: "mdi:radio",
  FiMonitor: "mdi:monitor",
  FiCompass: "mdi:compass-outline",
};

export const resolveIconValue = (value: string): string => {
  if (!value) return DEFAULT_ICON_OPTIONS[0].value;
  return LEGACY_ICON_VALUE_MAP[value] || value.trim();
};

const humanizeIconName = (iconName: string): string => {
  const raw = iconName.includes(":") ? iconName.split(":")[1] : iconName;
  return raw
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const getIconOption = (
  value: string,
  options: IconOption[] = DEFAULT_ICON_OPTIONS
): IconOption => {
  const prepared = resolveIconValue(value);
  return (
    options.find((option) => option.value === prepared) || {
      value: prepared || options[0].value,
      label: humanizeIconName(prepared || options[0].value),
    }
  );
};

type IconPickerProps = {
  value: string;
  onChange: (value: string) => void;
  options?: IconOption[];
  buttonClassName?: string;
  iconColor?: string;
  fullWidth?: boolean;
};

export default function IconPicker({
  value,
  onChange,
  options = DEFAULT_ICON_OPTIONS,
  buttonClassName = "",
  iconColor = "#1F2937",
  fullWidth = true,
}: IconPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remoteOptions, setRemoteOptions] = useState<IconOption[]>([]);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = getIconOption(value, options);

  const localFilteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(normalized) ||
      option.value.toLowerCase().includes(normalized)
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    const normalized = query.trim();
    if (normalized.length < 2) {
      setRemoteOptions([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `https://api.iconify.design/search?query=${encodeURIComponent(
            normalized
          )}&limit=120`,
          { signal: controller.signal }
        );
        const result = await response.json();
        const icons = Array.isArray(result?.icons) ? result.icons : [];
        const mapped: IconOption[] = icons.map((iconName: string) => ({
          value: iconName,
          label: humanizeIconName(iconName),
        }));
        setRemoteOptions(mapped);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setRemoteOptions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    };
  }, [isOpen, query]);

  const optionsToRender = useMemo(() => {
    const normalized = query.trim();
    const base = normalized.length >= 2 ? remoteOptions : localFilteredOptions;
    const dedup = new Map<string, IconOption>();
    dedup.set(selectedOption.value, selectedOption);
    base.forEach((option) => {
      if (!dedup.has(option.value)) {
        dedup.set(option.value, option);
      }
    });
    return Array.from(dedup.values());
  }, [localFilteredOptions, query, remoteOptions, selectedOption]);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 360;
      const viewportWidth = window.innerWidth;
      const left = Math.min(
        Math.max(8, rect.left),
        viewportWidth - dropdownWidth - 8
      );

      setPosition({
        top: rect.bottom + 8,
        left,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedButton && !clickedDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        ref={buttonRef}
        aria-label={t("icon_picker.choose")}
        className={`flex h-10 ${fullWidth ? "w-full" : "w-16"} items-center justify-between rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs transition hover:border-gray-400 ${buttonClassName}`}
      >
        <span className="inline-flex items-center">
          <Icon icon={selectedOption.value} width={16} height={16} color={iconColor} />
        </span>
        <span className="text-gray-400">▼</span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[100120] w-[360px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
            style={{ top: position.top, left: position.left }}
          >
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("icon_picker.search_placeholder")}
              className="mb-2 h-9 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />

            {isLoading && (
              <div className="px-2 pb-2 text-xs text-gray-500">{t("icon_picker.searching")}</div>
            )}

            <div className="grid max-h-72 grid-cols-8 gap-1 overflow-y-auto pr-1">
              {optionsToRender.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  aria-label={option.label || option.value}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                    selectedOption.value === option.value
                      ? "bg-brand-50 text-brand-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon icon={option.value} width={16} height={16} color={iconColor} />
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
