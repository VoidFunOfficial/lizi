import type { MapCalibration, MapPoint, Wgs84Point } from './campus-model.ts';

type Vector2 = { x: number; y: number };

type PlaneTransform = {
  evaluate(point: Vector2): Vector2;
};

export type CalibrationQualityStatus =
  | 'good'
  | 'usable'
  | 'needs-review'
  | 'poor-coverage';

export type CalibrationQuality = {
  anchorCount: number;
  method: MapCalibration['method'];
  fitRmsMeters: number;
  affineRmsMeters: number;
  maxErrorMeters: number;
  leaveOneOutRmsMeters?: number;
  declaredAccuracyRmsMeters?: number;
  coverage: number;
  status: CalibrationQualityStatus;
  accuracyStatement: string;
};

export type CalibrationLocalScale = {
  xMetersPerPixel: number;
  yMetersPerPixel: number;
  meanMetersPerPixel: number;
  anisotropy: number;
  axisAngleDegrees: number;
};

export type BuiltMapCalibration = {
  imageToWgs84(point: MapPoint): Wgs84Point | null;
  wgs84ToImage(point: Wgs84Point): MapPoint | null;
  polylineLengthMeters(points: MapPoint[]): number;
  localScale(point: MapPoint): CalibrationLocalScale | null;
  quality: CalibrationQuality;
};

const WGS84_SEMI_MAJOR_AXIS = 6_378_137;
const WGS84_ECCENTRICITY_SQUARED = 0.0066943799901413165;
const NUMERIC_EPSILON = 1e-12;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
}

function assertMapPoint(point: MapPoint, label: string): void {
  assertFinite(point.x, `${label}.x`);
  assertFinite(point.y, `${label}.y`);
}

function assertWgs84(point: Wgs84Point, label: string): void {
  assertFinite(point.latitude, `${label}.latitude`);
  assertFinite(point.longitude, `${label}.longitude`);
  if (point.latitude < -90 || point.latitude > 90) {
    throw new RangeError(`${label}.latitude must be between -90 and 90`);
  }
  if (point.longitude < -180 || point.longitude > 180) {
    throw new RangeError(`${label}.longitude must be between -180 and 180`);
  }
}

function distance(first: Vector2, second: Vector2): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function createLocalMetricProjection(points: Wgs84Point[]): {
  toLocal(point: Wgs84Point): Vector2;
  toWgs84(point: Vector2): Wgs84Point;
} {
  const origin = points.reduce(
    (sum, point) => ({
      latitude: sum.latitude + point.latitude / points.length,
      longitude: sum.longitude + point.longitude / points.length,
    }),
    { latitude: 0, longitude: 0 },
  );
  const latitudeRadians = (origin.latitude * Math.PI) / 180;
  const sine = Math.sin(latitudeRadians);
  const denominator = Math.sqrt(1 - WGS84_ECCENTRICITY_SQUARED * sine * sine);
  const primeVerticalRadius = WGS84_SEMI_MAJOR_AXIS / denominator;
  const meridionalRadius =
    (WGS84_SEMI_MAJOR_AXIS * (1 - WGS84_ECCENTRICITY_SQUARED)) /
    denominator ** 3;
  const longitudeMetersPerRadian =
    primeVerticalRadius * Math.cos(latitudeRadians);

  return {
    toLocal(point) {
      return {
        x:
          ((point.longitude - origin.longitude) *
            Math.PI *
            longitudeMetersPerRadian) /
          180,
        y:
          ((point.latitude - origin.latitude) * Math.PI * meridionalRadius) /
          180,
      };
    },
    toWgs84(point) {
      return {
        latitude:
          origin.latitude + (point.y * 180) / (Math.PI * meridionalRadius),
        longitude:
          origin.longitude +
          (point.x * 180) / (Math.PI * longitudeMetersPerRadian),
      };
    },
  };
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] {
  const size = values.length;
  if (matrix.length !== size || matrix.some((row) => row.length !== size)) {
    throw new Error('校准方程维度无效');
  }
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row;
      }
    }
    const pivot = augmented[pivotRow][column];
    if (Math.abs(pivot) < NUMERIC_EPSILON) {
      throw new Error('校准控制点退化，无法求解二维变换');
    }
    [augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ];
    for (let entry = column; entry <= size; entry += 1) {
      augmented[column][entry] /= pivot;
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      if (factor === 0) continue;
      for (let entry = column; entry <= size; entry += 1) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

function normalizeInput(points: Vector2[]): {
  points: Vector2[];
  normalize(point: Vector2): Vector2;
} {
  const center = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
  const scale = Math.sqrt(
    points.reduce(
      (sum, point) =>
        sum + (point.x - center.x) ** 2 + (point.y - center.y) ** 2,
      0,
    ) / points.length,
  );
  if (!Number.isFinite(scale) || scale < NUMERIC_EPSILON) {
    throw new Error('校准控制点不能全部重合');
  }
  const normalize = (point: Vector2): Vector2 => ({
    x: (point.x - center.x) / scale,
    y: (point.y - center.y) / scale,
  });
  return { points: points.map(normalize), normalize };
}

function fitAffine(inputs: Vector2[], outputs: Vector2[]): PlaneTransform {
  const normalized = normalizeInput(inputs);
  const normal = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const outputX = [0, 0, 0];
  const outputY = [0, 0, 0];
  normalized.points.forEach((point, index) => {
    const basis = [point.x, point.y, 1];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        normal[row][column] += basis[row] * basis[column];
      }
      outputX[row] += basis[row] * outputs[index].x;
      outputY[row] += basis[row] * outputs[index].y;
    }
  });
  const coefficientsX = solveLinearSystem(normal, outputX);
  const coefficientsY = solveLinearSystem(normal, outputY);
  return {
    evaluate(input) {
      const point = normalized.normalize(input);
      return {
        x:
          coefficientsX[0] * point.x +
          coefficientsX[1] * point.y +
          coefficientsX[2],
        y:
          coefficientsY[0] * point.x +
          coefficientsY[1] * point.y +
          coefficientsY[2],
      };
    },
  };
}

function tpsKernel(first: Vector2, second: Vector2): number {
  const squaredDistance = (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
  return squaredDistance < NUMERIC_EPSILON
    ? 0
    : squaredDistance * Math.log(squaredDistance);
}

function fitThinPlateSpline(
  inputs: Vector2[],
  outputs: Vector2[],
): PlaneTransform {
  const normalized = normalizeInput(inputs);
  const count = inputs.length;
  const size = count + 3;
  const matrix = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0),
  );
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      matrix[row][column] = tpsKernel(
        normalized.points[row],
        normalized.points[column],
      );
    }
    matrix[row][count] = 1;
    matrix[row][count + 1] = normalized.points[row].x;
    matrix[row][count + 2] = normalized.points[row].y;
    matrix[count][row] = 1;
    matrix[count + 1][row] = normalized.points[row].x;
    matrix[count + 2][row] = normalized.points[row].y;
  }
  const rightX = [...outputs.map((point) => point.x), 0, 0, 0];
  const rightY = [...outputs.map((point) => point.y), 0, 0, 0];
  const coefficientsX = solveLinearSystem(matrix, rightX);
  const coefficientsY = solveLinearSystem(matrix, rightY);
  return {
    evaluate(input) {
      const point = normalized.normalize(input);
      let x =
        coefficientsX[count] +
        coefficientsX[count + 1] * point.x +
        coefficientsX[count + 2] * point.y;
      let y =
        coefficientsY[count] +
        coefficientsY[count + 1] * point.x +
        coefficientsY[count + 2] * point.y;
      for (let index = 0; index < count; index += 1) {
        const kernel = tpsKernel(point, normalized.points[index]);
        x += coefficientsX[index] * kernel;
        y += coefficientsY[index] * kernel;
      }
      return { x, y };
    },
  };
}

function fitTransform(
  method: MapCalibration['method'],
  inputs: Vector2[],
  outputs: Vector2[],
): PlaneTransform {
  return method === 'thin-plate-spline'
    ? fitThinPlateSpline(inputs, outputs)
    : fitAffine(inputs, outputs);
}

function rootMeanSquare(errors: number[]): number {
  return Math.sqrt(
    errors.reduce((sum, error) => sum + error * error, 0) / errors.length,
  );
}

function convexHull(points: Vector2[]): Vector2[] {
  const sorted = [...points].sort((first, second) =>
    first.x === second.x ? first.y - second.y : first.x - second.x,
  );
  const cross = (origin: Vector2, first: Vector2, second: Vector2) =>
    (first.x - origin.x) * (second.y - origin.y) -
    (first.y - origin.y) * (second.x - origin.x);
  const lower: Vector2[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower.at(-2) as Vector2, lower.at(-1) as Vector2, point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: Vector2[] = [];
  for (const point of [...sorted].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper.at(-2) as Vector2, upper.at(-1) as Vector2, point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function polygonArea(points: Vector2[]): number {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    twiceArea += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(twiceArea) / 2;
}

function leaveOneOutRms(
  method: MapCalibration['method'],
  inputs: Vector2[],
  outputs: Vector2[],
): number | undefined {
  if (inputs.length < 4) return undefined;
  const errors: number[] = [];
  for (let omitted = 0; omitted < inputs.length; omitted += 1) {
    const remainingInputs = inputs.filter((_, index) => index !== omitted);
    const remainingOutputs = outputs.filter((_, index) => index !== omitted);
    try {
      const model = fitTransform(method, remainingInputs, remainingOutputs);
      errors.push(distance(model.evaluate(inputs[omitted]), outputs[omitted]));
    } catch {
      return undefined;
    }
  }
  return rootMeanSquare(errors);
}

function calibrationStatus(
  coverage: number,
  validationErrorMeters: number,
  anchorCount: number,
): CalibrationQualityStatus {
  if (coverage < 0.12) return 'poor-coverage';
  if (validationErrorMeters > 15) return 'needs-review';
  if (anchorCount >= 4 && coverage >= 0.35 && validationErrorMeters <= 5) {
    return 'good';
  }
  return 'usable';
}

function validateCalibration(
  calibration: MapCalibration,
  mapWidth: number,
  mapHeight: number,
): void {
  assertFinite(mapWidth, 'mapWidth');
  assertFinite(mapHeight, 'mapHeight');
  if (mapWidth <= 0 || mapHeight <= 0) {
    throw new RangeError('地图宽高必须大于 0');
  }
  if (calibration.schemaVersion !== 1) {
    throw new Error(`不支持校准格式版本 ${String(calibration.schemaVersion)}`);
  }
  if (calibration.anchors.length < 3) {
    throw new Error('地图校准至少需要 3 个控制点');
  }
  const ids = new Set<string>();
  for (const [index, anchor] of calibration.anchors.entries()) {
    if (!anchor.id.trim()) throw new Error(`控制点 ${index + 1} 缺少 id`);
    if (ids.has(anchor.id)) throw new Error(`控制点 id 重复：${anchor.id}`);
    ids.add(anchor.id);
    assertMapPoint(anchor.image, `anchors[${index}].image`);
    if (
      anchor.image.x < 0 ||
      anchor.image.x > 1 ||
      anchor.image.y < 0 ||
      anchor.image.y > 1
    ) {
      throw new RangeError(`控制点 ${anchor.id} 超出原图范围`);
    }
    assertWgs84(anchor.wgs84, `anchors[${index}].wgs84`);
  }
}

function refineInverse(
  forward: PlaneTransform,
  initial: Vector2,
  target: Vector2,
): Vector2 | null {
  let estimate = initial;
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const current = forward.evaluate(estimate);
    const error = { x: target.x - current.x, y: target.y - current.y };
    if (Math.hypot(error.x, error.y) < 1e-5) return estimate;
    const step = 0.25;
    const alongX = forward.evaluate({ x: estimate.x + step, y: estimate.y });
    const alongY = forward.evaluate({ x: estimate.x, y: estimate.y + step });
    const j00 = (alongX.x - current.x) / step;
    const j10 = (alongX.y - current.y) / step;
    const j01 = (alongY.x - current.x) / step;
    const j11 = (alongY.y - current.y) / step;
    const determinant = j00 * j11 - j01 * j10;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) {
      return null;
    }
    const deltaX = (error.x * j11 - j01 * error.y) / determinant;
    const deltaY = (j00 * error.y - error.x * j10) / determinant;
    const magnitude = Math.hypot(deltaX, deltaY);
    const damping = magnitude > 500 ? 500 / magnitude : 1;
    estimate = {
      x: estimate.x + deltaX * damping,
      y: estimate.y + deltaY * damping,
    };
    if (!Number.isFinite(estimate.x) || !Number.isFinite(estimate.y)) {
      return null;
    }
  }
  return distance(forward.evaluate(estimate), target) <= 0.05 ? estimate : null;
}

export function buildMapCalibration(
  calibration: MapCalibration,
  mapWidth: number,
  mapHeight: number,
): BuiltMapCalibration {
  validateCalibration(calibration, mapWidth, mapHeight);
  const imageInputs = calibration.anchors.map((anchor) => ({
    x: anchor.image.x * mapWidth,
    y: anchor.image.y * mapHeight,
  }));
  const projection = createLocalMetricProjection(
    calibration.anchors.map((anchor) => anchor.wgs84),
  );
  const metricOutputs = calibration.anchors.map((anchor) =>
    projection.toLocal(anchor.wgs84),
  );

  const imageHull = convexHull(
    calibration.anchors.map((anchor) => anchor.image),
  );
  const metricHull = convexHull(metricOutputs);
  if (
    imageHull.length < 3 ||
    polygonArea(imageHull) < 1e-8 ||
    metricHull.length < 3 ||
    polygonArea(metricHull) < 0.01
  ) {
    throw new Error('校准控制点必须在原图和真实空间中二维分散');
  }

  const affineForward = fitAffine(imageInputs, metricOutputs);
  const forward = fitTransform(calibration.method, imageInputs, metricOutputs);
  const reverseSeed = fitTransform(
    calibration.method,
    metricOutputs,
    imageInputs,
  );
  const fitErrors = imageInputs.map((point, index) =>
    distance(forward.evaluate(point), metricOutputs[index]),
  );
  const affineErrors = imageInputs.map((point, index) =>
    distance(affineForward.evaluate(point), metricOutputs[index]),
  );
  const fitRmsMeters = rootMeanSquare(fitErrors);
  const affineRmsMeters = rootMeanSquare(affineErrors);
  const leaveOneOutRmsMeters = leaveOneOutRms(
    calibration.method,
    imageInputs,
    metricOutputs,
  );
  const declaredAccuracies = calibration.anchors
    .map((anchor) => anchor.accuracyMeters)
    .filter((accuracy): accuracy is number => Number.isFinite(accuracy));
  const declaredAccuracyRmsMeters = declaredAccuracies.length
    ? rootMeanSquare(declaredAccuracies)
    : undefined;
  const coverage = Math.min(1, polygonArea(imageHull));
  const modelValidationErrorMeters =
    calibration.method === 'thin-plate-spline'
      ? (leaveOneOutRmsMeters ?? affineRmsMeters)
      : fitRmsMeters;
  const validationErrorMeters = Math.max(
    modelValidationErrorMeters,
    declaredAccuracyRmsMeters ?? 0,
  );
  const quality: CalibrationQuality = {
    anchorCount: calibration.anchors.length,
    method: calibration.method,
    fitRmsMeters,
    affineRmsMeters,
    maxErrorMeters: Math.max(...fitErrors),
    leaveOneOutRmsMeters,
    declaredAccuracyRmsMeters,
    coverage,
    status: calibrationStatus(
      coverage,
      validationErrorMeters,
      calibration.anchors.length,
    ),
    accuracyStatement:
      calibration.method === 'thin-plate-spline'
        ? 'TPS 训练点残差只表示模型穿过控制点，不代表实测定位精度；应使用未参与拟合的测量点验收。'
        : '拟合残差只表示模型与校准控制点的一致性；最终精度仍取决于控制点来源和独立测量验收。',
  };

  const imageToMetric = (point: MapPoint): Vector2 | null => {
    assertMapPoint(point, 'image point');
    const result = forward.evaluate({
      x: point.x * mapWidth,
      y: point.y * mapHeight,
    });
    return Number.isFinite(result.x) && Number.isFinite(result.y)
      ? result
      : null;
  };

  const imageToWgs84 = (point: MapPoint): Wgs84Point | null => {
    const metric = imageToMetric(point);
    return metric ? projection.toWgs84(metric) : null;
  };

  const wgs84ToImage = (point: Wgs84Point): MapPoint | null => {
    assertWgs84(point, 'WGS84 point');
    const target = projection.toLocal(point);
    const seed = reverseSeed.evaluate(target);
    const refined = refineInverse(forward, seed, target);
    return refined
      ? { x: refined.x / mapWidth, y: refined.y / mapHeight }
      : null;
  };

  const mappedSegmentLength = (
    first: MapPoint,
    second: MapPoint,
    depth = 0,
  ): number => {
    const firstMetric = imageToMetric(first) as Vector2;
    const secondMetric = imageToMetric(second) as Vector2;
    const midpoint = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
    const midpointMetric = imageToMetric(midpoint) as Vector2;
    const chord = distance(firstMetric, secondMetric);
    const split =
      distance(firstMetric, midpointMetric) +
      distance(midpointMetric, secondMetric);
    // Always inspect at least four subsegments. A TPS can form an S curve whose
    // midpoint lies on the endpoint chord even though its quarter points do not.
    if (
      depth >= 10 ||
      (depth >= 2 && split - chord <= Math.max(0.001, split * 0.00001))
    ) {
      return split;
    }
    return (
      mappedSegmentLength(first, midpoint, depth + 1) +
      mappedSegmentLength(midpoint, second, depth + 1)
    );
  };

  return {
    imageToWgs84,
    wgs84ToImage,
    polylineLengthMeters(points) {
      points.forEach((point, index) =>
        assertMapPoint(point, `polyline[${index}]`),
      );
      let length = 0;
      for (let index = 1; index < points.length; index += 1) {
        length += mappedSegmentLength(points[index - 1], points[index]);
      }
      return length;
    },
    localScale(point) {
      assertMapPoint(point, 'scale point');
      const horizontalStart = imageToMetric({
        x: point.x - 0.5 / mapWidth,
        y: point.y,
      });
      const horizontalEnd = imageToMetric({
        x: point.x + 0.5 / mapWidth,
        y: point.y,
      });
      const verticalStart = imageToMetric({
        x: point.x,
        y: point.y - 0.5 / mapHeight,
      });
      const verticalEnd = imageToMetric({
        x: point.x,
        y: point.y + 0.5 / mapHeight,
      });
      if (
        !horizontalStart ||
        !horizontalEnd ||
        !verticalStart ||
        !verticalEnd
      ) {
        return null;
      }
      const horizontal = {
        x: horizontalEnd.x - horizontalStart.x,
        y: horizontalEnd.y - horizontalStart.y,
      };
      const vertical = {
        x: verticalEnd.x - verticalStart.x,
        y: verticalEnd.y - verticalStart.y,
      };
      const xMetersPerPixel = Math.hypot(horizontal.x, horizontal.y);
      const yMetersPerPixel = Math.hypot(vertical.x, vertical.y);
      if (
        xMetersPerPixel < NUMERIC_EPSILON ||
        yMetersPerPixel < NUMERIC_EPSILON
      ) {
        return null;
      }
      const cosine = Math.max(
        -1,
        Math.min(
          1,
          (horizontal.x * vertical.x + horizontal.y * vertical.y) /
            (xMetersPerPixel * yMetersPerPixel),
        ),
      );
      return {
        xMetersPerPixel,
        yMetersPerPixel,
        meanMetersPerPixel: Math.sqrt(xMetersPerPixel * yMetersPerPixel),
        anisotropy:
          Math.max(xMetersPerPixel, yMetersPerPixel) /
          Math.min(xMetersPerPixel, yMetersPerPixel),
        axisAngleDegrees: (Math.acos(cosine) * 180) / Math.PI,
      };
    },
    quality,
  };
}
