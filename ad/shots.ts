export const SHOTS = [
  { id: '01-point', seconds: 4 },
  { id: '02-campus', seconds: 4 },
  { id: '03-pocket', seconds: 4 },
  { id: '04-search', seconds: 4 },
  { id: '05-route', seconds: 4 },
  { id: '06-options', seconds: 4 },
  { id: '07-weather', seconds: 4 },
  { id: '08-shadow', seconds: 4 },
  { id: '09-rain', seconds: 4 },
  { id: '10-access', seconds: 4 },
  { id: '11-live', seconds: 4 },
  { id: '12-places', seconds: 4 },
  { id: '13-import', seconds: 4 },
  { id: '14-week', seconds: 4 },
  { id: '15-day', seconds: 4 },
  { id: '16-classroute', seconds: 4 },
  { id: '17-plan', seconds: 4 },
  { id: '18-together', seconds: 4 },
  { id: '19-signature', seconds: 4 },
  { id: '20-end', seconds: 4 },
] as const;

export const sceneDirectory = (id: string) =>
  Number(id.slice(0, 2)) > 10
    ? `templates/student-life/scenes/${id}`
    : `scenes/${id}`;
