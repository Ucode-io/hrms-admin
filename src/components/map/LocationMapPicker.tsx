import { useEffect, useRef, useState } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Search } from "lucide-react";
import {
  DEFAULT_CENTER,
  OSM_ATTRIBUTION,
  OSM_TILES,
  PIN_ICON,
  formatCoords,
  parseCoords,
} from "./shared";

const NOMINATIM = "https://nominatim.openstreetmap.org";

const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?format=json&accept-language=ru&lat=${lat}&lon=${lon}`
    );
    const body = await res.json();
    return typeof body?.display_name === "string" ? body.display_name : "";
  } catch {
    return "";
  }
};

export default function LocationMapPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: { coordinates: string; address: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Kept in a ref so the map's click handler always sees the latest callback
  // without having to tear the map down on every parent re-render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [searchValue, setSearchValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchError, setSearchError] = useState("");

  const point = parseCoords(value);

  const placeMarker = (lat: number, lon: number) => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
      return;
    }

    markerRef.current = L.marker([lat, lon], { draggable: true, icon: PIN_ICON })
      .addTo(map)
      .on("dragend", (event) => {
        const dragged = (event.target as L.Marker).getLatLng();
        void select(dragged.lat, dragged.lng);
      });
  };

  const select = async (lat: number, lon: number) => {
    placeMarker(lat, lon);

    const coordinates = formatCoords(lat, lon);
    onChangeRef.current({ coordinates, address: "" });

    const address = await reverseGeocode(lat, lon);
    if (address) onChangeRef.current({ coordinates, address });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const start = parseCoords(value);
    const map = L.map(containerRef.current).setView(
      start ? [start.lat, start.lon] : DEFAULT_CENTER,
      start ? 16 : 11
    );

    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);

    map.on("click", (event: L.LeafletMouseEvent) => {
      void select(event.latlng.lat, event.latlng.lng);
    });

    mapRef.current = map;
    if (start) placeMarker(start.lat, start.lon);

    // The modal animates in, so the container can still be zero-sized here.
    const timeoutId = window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      window.clearTimeout(timeoutId);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // ponytail: mount-only — the map owns its viewport after the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setSearchError("Геолокация недоступна в этом браузере");
      return;
    }

    setIsLocating(true);
    setSearchError("");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setIsLocating(false);
        mapRef.current?.setView([coords.latitude, coords.longitude], 16);
        void select(coords.latitude, coords.longitude);
      },
      () => {
        setIsLocating(false);
        setSearchError("Не удалось определить местоположение");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearch = async () => {
    const query = searchValue.trim();
    if (!query || isSearching) return;

    setIsSearching(true);
    setSearchError("");

    try {
      const res = await fetch(
        `${NOMINATIM}/search?format=json&accept-language=ru&limit=1&q=${encodeURIComponent(query)}`
      );
      const [hit] = await res.json();

      if (!hit) {
        setSearchError("Ничего не найдено");
        return;
      }

      const lat = Number(hit.lat);
      const lon = Number(hit.lon);

      mapRef.current?.setView([lat, lon], 16);
      placeMarker(lat, lon);
      onChangeRef.current({
        coordinates: formatCoords(lat, lon),
        address: String(hit.display_name || ""),
      });
    } catch {
      setSearchError("Не удалось выполнить поиск");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setSearchError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSearch();
              }
            }}
            placeholder="Найти место на карте и нажать Enter"
            className="h-9 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
          />
        </div>

        <button
          type="button"
          onClick={handleLocate}
          disabled={isLocating}
          title="Моё местоположение"
          aria-label="Моё местоположение"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 shadow-theme-xs transition hover:bg-gray-50 disabled:opacity-60"
        >
          <LocateFixed size={16} className={isLocating ? "animate-pulse" : ""} />
          Я здесь
        </button>
      </div>

      {/* z-0 keeps Leaflet's panes from stacking over the modal's selects. */}
      <div
        ref={containerRef}
        className="relative z-0 h-[260px] w-full overflow-hidden rounded-lg border border-gray-300"
      />

      <p className="text-xs text-gray-500">
        {searchError ? (
          <span className="text-error-600">{searchError}</span>
        ) : point ? (
          `Выбрано: ${point.lat}, ${point.lon}`
        ) : (
          "Кликните по карте, чтобы выбрать точку"
        )}
      </p>
    </div>
  );
}
