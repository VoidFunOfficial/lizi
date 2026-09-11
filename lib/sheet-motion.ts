export function sheetReleaseTarget(
  position: number,
  velocity: number,
  distance: number,
): boolean {
  // A deliberate upward reversal always returns the sheet to its open position.
  if (velocity < -120) return false;
  return (
    position + ((velocity / 1000) * 0.998) / 0.002 >
    Math.min(distance * 0.35, 120)
  );
}

export function rubberbandSheet(position: number, distance: number): number {
  if (position >= 0 && position <= distance) return position;
  const edge = position < 0 ? 0 : distance;
  const excess = position - edge;
  return (
    edge + (excess * distance * 0.55) / (distance + 0.55 * Math.abs(excess))
  );
}

// Exact critically damped spring integration; stable even after a dropped frame.
export function stepSheetSpring(
  position: number,
  velocity: number,
  target: number,
  dt: number,
) {
  const omega = 22;
  const offset = position - target;
  const coefficient = velocity + omega * offset;
  const decay = Math.exp(-omega * dt);
  return {
    position: target + (offset + coefficient * dt) * decay,
    velocity: (velocity - omega * coefficient * dt) * decay,
  };
}
