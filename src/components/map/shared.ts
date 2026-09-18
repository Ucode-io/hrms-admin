import L from "leaflet";

export type Coords = { lat: number; lon: number };

/**
 * Значение поля MAP в ucode — строка «широта,долгота» в VARCHAR. Ни объекта,
 * ни GeoJSON там не бывает, поэтому разбор один на все карты: и на выбор точки
 * локации, и на просмотр отметки прихода (`attendance_records.map`).
 */
export function parseCoords(value: unknown): Coords | null {
  if (typeof value !== "string") return null;

  const [rawLat, rawLon, extra] = value.split(",");
  if (extra !== undefined || rawLat === undefined || rawLon === undefined) {
    return null;
  }

  const lat = Number(rawLat.trim());
  const lon = Number(rawLon.trim());

  // Широта и долгота Земли, а не любые два числа: «200,500» — не точка.
  const valid =
    rawLat.trim() !== "" &&
    rawLon.trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;

  return valid ? { lat, lon } : null;
}

// Шесть знаков — метр точности; полный float в ячейке — шум.
export const formatCoords = (lat: number, lon: number): string =>
  `${lat.toFixed(6)},${lon.toFixed(6)}`;

/**
 * Метка рисуется inline-SVG, а не картинкой из leaflet/dist/images.
 *
 * У приложения SPA-фолбэк: несуществующий путь отдаёт index.html с кодом 200,
 * поэтому любой промах в резолве URL иконки давал не 404, а молча HTML вместо
 * PNG — то есть сломанную картинку. Резолвить нечего — ломаться нечему.
 */
export const PIN_ICON = L.divIcon({
  className: "",
  html: `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 9.7 13 23 13 23s13-13.3 13-23c0-7.2-5.8-13-13-13z"
      fill="var(--color-brand-500, #465fff)" stroke="#fff" stroke-width="1.5"/>
    <circle cx="13" cy="13" r="4.5" fill="#fff"/>
  </svg>`,
  iconSize: [26, 36],
  // Остриё метки, а не её центр, стоит на выбранной точке.
  iconAnchor: [13, 36],
});

/**
 * Радиус офиса по умолчанию, метры.
 *
 * Точность GPS на телефоне — десятки метров, поэтому порог меньше сотни давал
 * бы предупреждение на людей, стоящих в дверях. 200 м закрывает здание с
 * парковкой; склад или территорию шире — полем `radius` у самой локации.
 */
export const DEFAULT_OFFICE_RADIUS_M = 200;

/**
 * Расстояние между точками по формуле гаверсинуса, метры.
 *
 * ponytail: сфера, а не эллипсоид WGS84 — на сотнях метров расхождение с
 * настоящей геодезией сантиметровое, а порог тут и так в сотнях метров.
 */
export function distanceMeters(from: Coords, to: Coords): number {
  const EARTH_RADIUS_M = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Радиус из поля локации; пустое, ноль и мусор — падаем на дефолт. */
export function officeRadius(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_OFFICE_RADIUS_M;
}

export const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = "&copy; OpenStreetMap";
// Ташкент — центр карты, пока точка не выбрана.
export const DEFAULT_CENTER: L.LatLngTuple = [41.311081, 69.240562];
