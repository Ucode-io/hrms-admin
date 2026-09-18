import { useEffect, useRef, useState } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, TriangleAlert, X } from "lucide-react";
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
  meters < 1000 ? `${Math.round(meters)} м` : `${(meters / 1000).toFixed(1)} км`;

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

/**
 * Показывает точку отметки на карте в попапе.
 *
 * Значение — строка поля MAP («широта,долгота»). Если разобрать не удалось,
 * это не координаты, а свободный текст (старые записи, адрес) — такой ссылке
 * карту не построить, поэтому остаётся прежнее поведение со ссылкой наружу.
 */
export default function LocationViewLink({
  value,
  label = "Открыть на карте",
  office,
}: {
  value: string;
  label?: string;
  /** Офис сотрудника; без него предупреждение не считается. */
  office?: Office | null;
}) {
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

  const warning = check?.outside
    ? `Отметка в ${humanDistance(check.distanceM)} от офиса${check.title ? ` «${check.title}»` : ""} — это дальше разрешённых ${check.radiusM} м`
    : "";

  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1 text-brand-500 hover:underline"
        >
          {label}
          <MapPin className="h-3.5 w-3.5" />
        </button>

        {warning ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            title={warning}
            className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700"
          >
            <TriangleAlert className="h-3 w-3" />
            {humanDistance(check!.distanceM)} от офиса
          </button>
        ) : null}
      </span>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[640px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Локация</h3>
            <p className="text-xs text-gray-500">
              {point.lat}, {point.lon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
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
            <p className="text-xs text-gray-500">
              {humanDistance(check.distanceM)} от офиса
              {check.title ? ` «${check.title}»` : ""} — в пределах {check.radiusM} м
            </p>
          ) : null}

          <ReadOnlyMap point={point} office={check} />
        </div>
      </Modal>
    </>
  );
}
