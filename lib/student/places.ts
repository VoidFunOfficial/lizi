import type { Place } from '../campus-model.ts';

const DINING_NAMES: Record<string, string> = {
  芙蓉: '芙蓉',
  芙蓉园: '芙蓉',
  芙蓉食堂: '芙蓉',
  兰苑: '兰苑',
  兰苑食堂: '兰苑',
  樱花: '樱花',
  樱花苑: '樱花',
  樱花苑食堂: '樱花',
  樱花食堂: '樱花',
};

export const isDormitory = (place: Place): boolean =>
  /^(?:学生)?(?:宿舍|寝室)(?:\d+[A-Z]?)?$/.test(
    place.name.normalize('NFKC').replace(/\s/g, '').toUpperCase(),
  );

export const diningLabel = (place: Place): string | null => {
  const name = place.name.normalize('NFKC').trim();
  return Object.hasOwn(DINING_NAMES, name) ? DINING_NAMES[name] : null;
};

// Apply the same constraints to controls, saved preferences and route planning.
export function allowedPersonalPlaces<
  T extends { homeId: string; diningIds: string[] },
>(preferences: T, places: Place[]): T {
  const dorms = new Set(places.filter(isDormitory).map((p) => p.id));
  const dining = new Set(places.filter((p) => diningLabel(p)).map((p) => p.id));
  return {
    ...preferences,
    homeId: dorms.has(preferences.homeId) ? preferences.homeId : '',
    diningIds: [...new Set(preferences.diningIds)].filter((id) =>
      dining.has(id),
    ),
  };
}
