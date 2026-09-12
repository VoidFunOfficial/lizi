// @bun
// src/errors.ts
class SdkError extends Error {
  code;
  details;
  constructor(code, message, details) {
    super(message);
    this.name = "SdkError";
    this.code = code;
    if (details !== undefined)
      this.details = details;
  }
}
function sdkFail(code, message, details) {
  throw new SdkError(code, message, details);
}

// src/phy2d.ts
function fail(field, message, value) {
  throw new SdkError("INVALID_PHY2D_CONFIG", `Phy2D ${field} ${message}`, { field, value });
}
function finite(value, field) {
  if (!Number.isFinite(value))
    fail(field, "must be finite", value);
  return value;
}
function positive(value, field) {
  finite(value, field);
  if (value <= 0)
    fail(field, "must be greater than 0", value);
  return value;
}
function unit(value, field) {
  finite(value, field);
  if (value < 0 || value > 1)
    fail(field, "must be between 0 and 1", value);
  return value;
}
function vector(value, field) {
  return { x: finite(value.x, `${field}.x`), y: finite(value.y, `${field}.y`) };
}
function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}
function polygonArea(particles) {
  let twiceArea = 0;
  for (let index = 0;index < particles.length; index += 1) {
    const current = particles[index];
    const next = particles[(index + 1) % particles.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea * 0.5;
}
function centroid(particles) {
  let x = 0;
  let y = 0;
  for (const particle of particles) {
    x += particle.x;
    y += particle.y;
  }
  return { x: x / particles.length, y: y / particles.length };
}
function makeBody(id, options) {
  const center = vector(options.center, "softBody.center");
  const radius = positive(options.radius, "softBody.radius");
  const particleCount = options.particleCount ?? 18;
  if (!Number.isSafeInteger(particleCount) || particleCount < 8 || particleCount > 128) {
    fail("softBody.particleCount", "must be a safe integer between 8 and 128", particleCount);
  }
  const phase = finite(options.phase ?? 0, "softBody.phase");
  const structuralStiffness = unit(options.structuralStiffness ?? 0.94, "softBody.structuralStiffness");
  const bendingStiffness = unit(options.bendingStiffness ?? 0.38, "softBody.bendingStiffness");
  const shapeStiffness = unit(options.shapeStiffness ?? 0.055, "softBody.shapeStiffness");
  const pressureStiffness = unit(options.pressureStiffness ?? 0.16, "softBody.pressureStiffness");
  if (options.initialVelocities !== undefined && options.initialVelocities.length !== particleCount) {
    fail("softBody.initialVelocities", "must match particleCount", options.initialVelocities.length);
  }
  const particles = Array.from({ length: particleCount }, (_, index) => {
    const angle = phase + index / particleCount * Math.PI * 2;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    const velocity = options.initialVelocities?.[index] ?? { x: 0, y: 0 };
    vector(velocity, `softBody.initialVelocities[${index}]`);
    return {
      x,
      y,
      previousX: x - velocity.x,
      previousY: y - velocity.y
    };
  });
  const constraints = [];
  for (let index = 0;index < particleCount; index += 1) {
    for (const [span, stiffness] of [
      [1, structuralStiffness],
      [2, bendingStiffness],
      [Math.floor(particleCount / 2), shapeStiffness]
    ]) {
      const other = (index + span) % particleCount;
      if (span === Math.floor(particleCount / 2) && index >= other)
        continue;
      constraints.push({
        a: index,
        b: other,
        rest: distance(particles[index], particles[other]),
        stiffness
      });
    }
  }
  return {
    id,
    particles,
    constraints,
    restArea: Math.abs(polygonArea(particles)),
    pressureStiffness
  };
}
function solveDistance(body, constraint, targetStructureScale) {
  const left = body.particles[constraint.a];
  const right = body.particles[constraint.b];
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const current = Math.hypot(dx, dy);
  if (current < 0.000001)
    return;
  const targetLength = constraint.rest * targetStructureScale;
  const correction = (current - targetLength) / current * constraint.stiffness * 0.5;
  left.x += dx * correction;
  left.y += dy * correction;
  right.x -= dx * correction;
  right.y -= dy * correction;
}
function solveArea(body, targetScale) {
  const currentArea = polygonArea(body.particles);
  const error = currentArea - body.restArea * targetScale;
  let denominator = 0;
  const gradients = [];
  for (let index = 0;index < body.particles.length; index += 1) {
    const previous = body.particles[(index - 1 + body.particles.length) % body.particles.length];
    const next = body.particles[(index + 1) % body.particles.length];
    const gradient = {
      x: (next.y - previous.y) * 0.5,
      y: (previous.x - next.x) * 0.5
    };
    gradients.push(gradient);
    denominator += gradient.x * gradient.x + gradient.y * gradient.y;
  }
  if (denominator < 0.000001)
    return;
  const multiplier = error / denominator * body.pressureStiffness;
  for (let index = 0;index < body.particles.length; index += 1) {
    const particle = body.particles[index];
    const gradient = gradients[index];
    particle.x -= gradient.x * multiplier;
    particle.y -= gradient.y * multiplier;
  }
}
function pointInside(point, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1;current < polygon.length; previous = current, current += 1) {
    const a = polygon[current];
    const b = polygon[previous];
    if (a.y > point.y !== b.y > point.y && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
function projectOut(point, polygon, polygonCenter, relaxation) {
  if (!pointInside(point, polygon))
    return;
  let closestX = point.x;
  let closestY = point.y;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;
  for (let index = 0;index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared < 0.000001 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    const x = start.x + dx * projection;
    const y = start.y + dy * projection;
    const distanceSquared = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestX = x;
      closestY = y;
    }
  }
  let normalX = closestX - polygonCenter.x;
  let normalY = closestY - polygonCenter.y;
  const normalLength = Math.hypot(normalX, normalY) || 1;
  normalX /= normalLength;
  normalY /= normalLength;
  point.x += (closestX - point.x + normalX * 1.6) * relaxation;
  point.y += (closestY - point.y + normalY * 1.6) * relaxation;
}

class Phy2dWorldImplementation {
  width;
  height;
  #gravity;
  #damping;
  #solverIterations;
  #wallPadding;
  #bodies = [];
  #stepCount = 0;
  constructor(options) {
    this.width = positive(options.width, "world.width");
    this.height = positive(options.height, "world.height");
    this.#gravity = vector(options.gravity ?? { x: 0, y: 0 }, "world.gravity");
    this.#damping = unit(options.damping ?? 0.955, "world.damping");
    this.#wallPadding = finite(options.wallPadding ?? 0, "world.wallPadding");
    if (this.#wallPadding < 0 || this.#wallPadding * 2 >= Math.min(this.width, this.height)) {
      fail("world.wallPadding", "must fit within the world bounds", this.#wallPadding);
    }
    this.#solverIterations = options.solverIterations ?? 6;
    if (!Number.isSafeInteger(this.#solverIterations) || this.#solverIterations < 1 || this.#solverIterations > 64) {
      fail("world.solverIterations", "must be a safe integer between 1 and 64", this.#solverIterations);
    }
  }
  get bodyCount() {
    return this.#bodies.length;
  }
  get stepCount() {
    return this.#stepCount;
  }
  addSoftBody(options) {
    const body = makeBody(this.#bodies.length, options);
    this.#bodies.push(body);
    return Object.freeze({ id: body.id });
  }
  step(options = {}) {
    const targetAreaScale = positive(options.targetAreaScale ?? 1, "step.targetAreaScale");
    const targetStructureScale = positive(options.targetStructureScale ?? 1, "step.targetStructureScale");
    const collisionRelaxation = unit(options.collisionRelaxation ?? 0.42, "step.collisionRelaxation");
    if (options.bodyAccelerations !== undefined && options.bodyAccelerations.length > this.#bodies.length) {
      fail("step.bodyAccelerations", "cannot contain more entries than bodies", options.bodyAccelerations.length);
    }
    for (let bodyIndex = 0;bodyIndex < this.#bodies.length; bodyIndex += 1) {
      const body = this.#bodies[bodyIndex];
      const acceleration = vector(options.bodyAccelerations?.[bodyIndex] ?? { x: 0, y: 0 }, `step.bodyAccelerations[${bodyIndex}]`);
      for (const particle of body.particles) {
        const velocityX = (particle.x - particle.previousX) * this.#damping;
        const velocityY = (particle.y - particle.previousY) * this.#damping;
        particle.previousX = particle.x;
        particle.previousY = particle.y;
        particle.x += velocityX + this.#gravity.x + acceleration.x;
        particle.y += velocityY + this.#gravity.y + acceleration.y;
      }
    }
    for (let iteration = 0;iteration < this.#solverIterations; iteration += 1) {
      for (const body of this.#bodies) {
        for (const constraint of body.constraints) {
          solveDistance(body, constraint, targetStructureScale);
        }
        solveArea(body, targetAreaScale);
        this.#solveWalls(body);
      }
      this.#solveCollisions(collisionRelaxation);
    }
    this.#stepCount += 1;
  }
  snapshot() {
    return Object.freeze({
      step: this.#stepCount,
      bodies: Object.freeze(this.#bodies.map((body) => {
        const center = centroid(body.particles);
        return Object.freeze({
          id: body.id,
          center: Object.freeze(center),
          area: Math.abs(polygonArea(body.particles)),
          restArea: body.restArea,
          particles: Object.freeze(body.particles.map((particle) => Object.freeze({ ...particle })))
        });
      }))
    });
  }
  #solveWalls(body) {
    const minimumX = this.#wallPadding;
    const minimumY = this.#wallPadding;
    const maximumX = this.width - this.#wallPadding;
    const maximumY = this.height - this.#wallPadding;
    for (const particle of body.particles) {
      particle.x = Math.max(minimumX, Math.min(maximumX, particle.x));
      particle.y = Math.max(minimumY, Math.min(maximumY, particle.y));
    }
  }
  #solveCollisions(relaxation) {
    if (relaxation <= 0)
      return;
    const centers = this.#bodies.map((body) => centroid(body.particles));
    const radii = this.#bodies.map((body, index) => Math.max(...body.particles.map((particle) => Math.hypot(particle.x - centers[index].x, particle.y - centers[index].y))));
    for (let leftIndex = 0;leftIndex < this.#bodies.length; leftIndex += 1) {
      const left = this.#bodies[leftIndex];
      for (let rightIndex = leftIndex + 1;rightIndex < this.#bodies.length; rightIndex += 1) {
        const right = this.#bodies[rightIndex];
        const leftCenter = centers[leftIndex];
        const rightCenter = centers[rightIndex];
        if (Math.hypot(rightCenter.x - leftCenter.x, rightCenter.y - leftCenter.y) > radii[leftIndex] + radii[rightIndex] + 4)
          continue;
        for (const particle of left.particles) {
          projectOut(particle, right.particles, rightCenter, relaxation);
        }
        for (const particle of right.particles) {
          projectOut(particle, left.particles, leftCenter, relaxation);
        }
      }
    }
  }
}
function createPhy2dWorld(options) {
  return new Phy2dWorldImplementation(options);
}
export {
  createPhy2dWorld
};

//# debugId=479821426D6D7DC464756E2164756E21
