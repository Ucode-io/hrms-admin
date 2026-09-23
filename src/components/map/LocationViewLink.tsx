import { useEffect, useRef, useState } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, MessageSquareText, TriangleAlert, X } from "lucide-react";
import { Modal } from "../ui/modal";
import {
  OSM_ATTRIBUTION,
  OSM_TILES,
  PIN_ICON,
  type Coords,
  distanceMeters,
  parseCoords,
} from "./shared";
import type { Office } from "./useOffices";
import { useTranslation, translate } from "../../i18n";

type OfficeCheck = {
  title: string;
  point: Coords;
  radiusM: number;
  distanceM: number;
  outside: boolean;
};

/**
 * Сверяет отметку с офисом сотрудника.
 *
 * Возвращает null, когда сверять не с чем: филиал у человека не проставлен
 * либо у офиса нет координат. Это не нарушение, а незаполненный справочник —
 * предупреждать тут не о чем.
 */
function checkAgainstOffice(point: Coords, office: Office | null | undefined): OfficeCheck | null {
  const officePoint = office ? parseCoords(office.coordinates) : null;
  if (!office || !officePoint) return null;

  const distanceM = distanceMeters(point, officePoint);

  return {
    title: office.title,
    point: officePoint,
    radiusM: office.radiusM,
    distanceM,
    outside: distanceM > office.radiusM,
  };
}

/** «120 м» / «1.4 км» — в подписи нужен порядок, а не точность до метра. */
const humanDistance = (meters: number): string =>
  meters < 1000
    ? translate("map.distance_m", { value: Math.round(meters) })
    : translate("map.distance_km", { value: (meters / 1000).toFixed(1) });

function ReadOnlyMap({ point, office }: { point: Coords; office: OfficeCheck | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView([point.lat, point.lon], 16);
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
    L.marker([point.lat, point.lon], { icon: PIN_ICON }).addTo(map);

    // Круг офиса показывает, насколько человек промахнулся мимо своего
    // филиала, а не только факт промаха.
    if (office) {
      L.circle([office.point.lat, office.point.lon], {
        radius: office.radiusM,
        color: office.outside ? "#f04438" : "#12b76a",
        weight: 1,
        fillOpacity: 0.08,
      }).addTo(map);
      map.fitBounds(
        L.latLngBounds([point.lat, point.lon], [office.point.lat, office.point.lon]).pad(0.4)
      );
    }

    // The modal mounts its content on open, so the container can still be
    // zero-sized on this first pass.
    const timeoutId = window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      window.clearTimeout(timeoutId);
      map.remove();
    };
  }, [point.lat, point.lon, office]);

  return (
    <div
      ref={containerRef}
      className="relative z-0 h-[360px] w-full overflow-hidden rounded-lg border border-gray-200"
    />
  );
}

const distanceTitle = (check: OfficeCheck): string =>
  translate(check.outside ? "map.distance_outside" : "map.distance_inside", {
    distance: humanDistance(check.distanceM),
    office: check.title ? ` «${check.title}»` : "",
    radius: check.radiusM,
  });

function DistanceChip({ check, prefix, reason }: { check: OfficeCheck; prefix?: string; reason?: string }) {
  return (
    <span
      title={reason ? `${distanceTitle(check)}\n«${reason}»` : distanceTitle(check)}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        check.outside ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"
      }`}
    >
      {check.outside ? <TriangleAlert className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
      {prefix ? `${prefix} ` : ""}
      {humanDistance(check.distanceM)}
      {/* Причина — в подсказке и в окне карты, чтобы строка таблицы оставалась одной. */}
      {reason ? <MessageSquareText className="h-3 w-3" /> : null}
    </span>
  );
}

/**
 * Расстояние отметки до офиса сотрудника: зелёное в радиусе филиала, жёлтое за
 * ним. Без точки или без офиса с координатами сверять не с чем — прочерк.
 */
export function DistanceBadge({
  value,
  office,
  prefix,
  reason,
}: {
  value: string;
  office?: Office | null;
  /** «Приход» / «Уход», когда рядом стоят обе отметки. */
  prefix?: string;
  /** Причина, которую сотрудник написал к отметке вне филиала. */
  reason?: string;
}) {
  const point = parseCoords(value);
  const check = point ? checkAgainstOffice(point, office) : null;
  const badge = check ? <DistanceChip check={check} prefix={prefix} /> : <span className="text-gray-400">—</span>;
  if (!reason) return badge;

  return (
    <span className="inline-flex max-w-[180px] flex-col items-start gap-0.5">
      {badge}
      <MarkReason reason={reason} />
    </span>
  );
}

/** Причина отметки одной строкой; полный текст — в подсказке. */
export function MarkReason({ reason }: { reason: string }) {
  return (
    <span title={reason} className="block max-w-full truncate text-[11px] italic text-gray-500">
      «{reason}»
    </span>
  );
}

/**
 * Показывает точку отметки на карте в попапе.
 *
 * Значение — строка поля MAP («широта,долгота»). Если разобрать не удалось,
 * это не координаты, а свободный текст (старые записи, адрес) — такой ссылке
 * карту не построить, поэтому остаётся прежнее поведение со ссылкой наружу.
 */
export default function LocationViewLink({
  value,
  label,
  office,
  showDistance = true,
  chipPrefix,
  reason,
}: {
  value: string;
  label?: string;
  /**
   * Компактный вид для таблиц: вместо ссылки — только бейдж расстояния с этой
   * подписью («Приход»), и карту открывает он сам.
   */
  chipPrefix?: string;
  /** Причина отметки вне филиала: иконка в бейдже и строка в окне карты. */
  reason?: string;
  /** false — когда расстояние уже стоит рядом отдельным `DistanceBadge`. */
  showDistance?: boolean;
  /** Офис сотрудника; без него предупреждение не считается. */
  office?: Office | null;
}) {
  const { t } = useTranslation();
  label ??= t("map.open_on_map");
  const [isOpen, setIsOpen] = useState(false);
  const point = parseCoords(value);
  const check = point ? checkAgainstOffice(point, office) : null;

  if (!point) {
    return (
      <a
        href={`https://maps.google.com/?q=${encodeURIComponent(value)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-brand-500 hover:underline"
      >
        {label}
      </a>
    );
  }

  const warning = check?.outside ? distanceTitle(check) : "";

  return (
    <>
      {chipPrefix !== undefined && check ? (
        <button type="button" onClick={() => setIsOpen(true)} className="hover:opacity-80">
          <DistanceChip check={check} prefix={chipPrefix} reason={reason} />
        </button>
      ) : (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1 whitespace-nowrap text-brand-500 hover:underline"
        >
          {chipPrefix ?? label}
          <MapPin className="h-3.5 w-3.5" />
        </button>

        {check && showDistance && chipPrefix === undefined ? (
          <button type="button" onClick={() => setIsOpen(true)}>
            <DistanceChip check={check} />
          </button>
        ) : null}
      </span>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[640px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{t("map.location_title")}</h3>
            <p className="text-xs text-gray-500">
              {point.lat}, {point.lon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {warning ? (
            <p className="flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {warning}
            </p>
          ) : check ? (
            <p className="text-xs text-success-700">{distanceTitle(check)}</p>
          ) : null}
          {reason ? (
            <p className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
              <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {reason}
            </p>
          ) : null}

          <ReadOnlyMap point={point} office={check} />
        </div>
      </Modal>
    </>
  );
}
