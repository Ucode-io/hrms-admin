import { useMemo } from "react";

import { useLocationsQuery } from "../../api/services/location.service";
import { officeRadius } from "./shared";

export type Office = {
  title: string;
  /** Строка поля MAP: «широта,долгота». Пустая, если у офиса нет точки. */
  coordinates: string;
  radiusM: number;
};

/**
 * Офис сотрудника лежит в `user_base.locations_id`, а координаты — в самой
 * локации. Второй уровень связи ucode не разворачивает (`locations_id_data`
 * приходит `null` даже при заполненном `locations_id`), поэтому справочник
 * тянем отдельно — их девять штук, и react-query держит их в кеше на все
 * экраны сразу.
 */
export function useOffices(): Map<string, Office> {
  const { data } = useLocationsQuery({
    params: { limit: 1000, offset: 0 },
  });

  return useMemo(() => {
    const byId = new Map<string, Office>();

    for (const location of data?.response || []) {
      byId.set(location.guid, {
        title: String(location.title || ""),
        coordinates: String(location.coordinates || ""),
        radiusM: officeRadius(location.radius),
      });
    }

    return byId;
  }, [data?.response]);
}
