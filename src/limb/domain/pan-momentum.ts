/**
 * PanMomentum — physics model for inertial panning with boundary damping.
 *
 * Friction: velocity halves every 120ms per axis (same as zoom momentum §1.1).
 * Velocity tracking: last 3 drag events within a 150ms window.
 * Momentum stops when both axes drop below 0.001 units/ms.
 * Boundary damping: 80% speed reduction outside tree bounds.
 * Snap-back: 200ms ease-out animation to nearest tree edge when outside bounds.
 * Visibility: viewport center clamped so ≥20% of tree remains visible.
 */

const HALF_LIFE_MS = 120;
const MIN_VELOCITY = 0.001;
const WINDOW_MS = 150;
const MIN_EVENTS_FOR_MOMENTUM = 3;
const BOUNDARY_DAMPING = 0.2;
const SNAP_BACK_DURATION_MS = 200;
const VISIBILITY_FACTOR = 0.3;

interface DragEvent {
  timestamp: number;
  dx: number;
  dy: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

type State = 'idle' | 'released' | 'momentum' | 'snap-back';

function isOutside(point: Point, rect: Rect): boolean {
  return (
    point.x < rect.x ||
    point.x > rect.x + rect.width ||
    point.y < rect.y ||
    point.y > rect.y + rect.height
  );
}

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function easeOut(t: number): number {
  return t * (2 - t);
}

function clampToVisibility(
  center: Point,
  dx: number,
  dy: number,
  bounds: Rect
): { dx: number; dy: number } {
  const newX = center.x + dx;
  const newY = center.y + dy;

  const minX = bounds.x - VISIBILITY_FACTOR * bounds.width;
  const maxX = bounds.x + bounds.width + VISIBILITY_FACTOR * bounds.width;
  const minY = bounds.y - VISIBILITY_FACTOR * bounds.height;
  const maxY = bounds.y + bounds.height + VISIBILITY_FACTOR * bounds.height;

  return {
    dx: clampValue(newX, minX, maxX) - center.x,
    dy: clampValue(newY, minY, maxY) - center.y,
  };
}

function nearestEdgePoint(point: Point, rect: Rect): Point {
  return {
    x: clampValue(point.x, rect.x, rect.x + rect.width),
    y: clampValue(point.y, rect.y, rect.y + rect.height),
  };
}

export class PanMomentum {
  private events: DragEvent[] = [];
  private vx = 0;
  private vy = 0;
  private state: State = 'idle';

  // Snap-back state
  private snapStartX = 0;
  private snapStartY = 0;
  private snapTargetX = 0;
  private snapTargetY = 0;
  private snapElapsed = 0;

  /**
   * Records a drag movement. If momentum or snap-back is active, cancels it.
   */
  recordDrag(timestamp: number, dx: number, dy: number): void {
    if (this.state === 'momentum' || this.state === 'snap-back') {
      this.interrupt();
    }

    this.events.push({ timestamp, dx, dy });
    if (this.events.length > MIN_EVENTS_FOR_MOMENTUM) {
      this.events.shift();
    }
  }

  /**
   * Computes release velocity from recent drag events.
   * Returns { vx: 0, vy: 0 } if fewer than 3 events within the 150ms window.
   */
  release(timestamp: number): { vx: number; vy: number } {
    const recent = this.events.filter(
      (e) => timestamp - e.timestamp <= WINDOW_MS
    );

    if (recent.length < MIN_EVENTS_FOR_MOMENTUM) {
      this.vx = 0;
      this.vy = 0;
    } else {
      const totalDx = recent.reduce((sum, e) => sum + e.dx, 0);
      const totalDy = recent.reduce((sum, e) => sum + e.dy, 0);
      const timeSpan =
        recent[recent.length - 1].timestamp - recent[0].timestamp;

      if (timeSpan === 0) {
        this.vx = 0;
        this.vy = 0;
      } else {
        this.vx = totalDx / timeSpan;
        this.vy = totalDy / timeSpan;
      }
    }

    this.state = 'released';
    this.events = [];
    return { vx: this.vx, vy: this.vy };
  }

  /**
   * Applies friction and boundary damping for dt milliseconds.
   * Returns the pan delta for this tick and whether momentum/snap-back is done.
   */
  tick(
    dt: number,
    treeBounds: Rect,
    viewportCenter: Point
  ): { dx: number; dy: number; done: boolean } {
    if (this.state === 'idle') {
      return { dx: 0, dy: 0, done: true };
    }

    const outside = isOutside(viewportCenter, treeBounds);

    if (this.state === 'released') {
      if (
        Math.abs(this.vx) >= MIN_VELOCITY ||
        Math.abs(this.vy) >= MIN_VELOCITY
      ) {
        this.state = 'momentum';
      } else if (outside) {
        this.initSnapBack(viewportCenter, treeBounds);
        this.state = 'snap-back';
      } else {
        this.state = 'idle';
        return { dx: 0, dy: 0, done: true };
      }
    }

    if (this.state === 'momentum') {
      return this.tickMomentum(dt, treeBounds, viewportCenter, outside);
    }

    if (this.state === 'snap-back') {
      return this.tickSnapBack(dt, viewportCenter);
    }

    return { dx: 0, dy: 0, done: true };
  }

  /**
   * Returns true when no momentum or snap-back is active.
   */
  isIdle(): boolean {
    return this.state === 'idle';
  }

  /**
   * Cancels active momentum or snap-back immediately.
   */
  interrupt(): void {
    this.vx = 0;
    this.vy = 0;
    this.state = 'idle';
  }

  private tickMomentum(
    dt: number,
    treeBounds: Rect,
    viewportCenter: Point,
    outside: boolean
  ): { dx: number; dy: number; done: boolean } {
    const decay = Math.pow(0.5, dt / HALF_LIFE_MS);

    const newVx = this.vx * decay;
    const newVy = this.vy * decay;

    let dx = ((this.vx + newVx) / 2) * dt;
    let dy = ((this.vy + newVy) / 2) * dt;

    this.vx = newVx;
    this.vy = newVy;

    // Apply boundary damping: 80% speed reduction outside bounds
    if (outside) {
      dx *= BOUNDARY_DAMPING;
      dy *= BOUNDARY_DAMPING;
    }

    // Apply 20% visibility clamp
    const clamped = clampToVisibility(viewportCenter, dx, dy, treeBounds);
    dx = clamped.dx;
    dy = clamped.dy;

    // Check if both axes below threshold
    if (
      Math.abs(this.vx) < MIN_VELOCITY &&
      Math.abs(this.vy) < MIN_VELOCITY
    ) {
      this.vx = 0;
      this.vy = 0;

      const newCenter = {
        x: viewportCenter.x + dx,
        y: viewportCenter.y + dy,
      };

      if (isOutside(newCenter, treeBounds)) {
        this.initSnapBack(newCenter, treeBounds);
        this.state = 'snap-back';
        return { dx, dy, done: false };
      }

      this.state = 'idle';
      return { dx, dy, done: true };
    }

    return { dx, dy, done: false };
  }

  private initSnapBack(from: Point, treeBounds: Rect): void {
    const target = nearestEdgePoint(from, treeBounds);
    this.snapStartX = from.x;
    this.snapStartY = from.y;
    this.snapTargetX = target.x;
    this.snapTargetY = target.y;
    this.snapElapsed = 0;
  }

  private tickSnapBack(
    dt: number,
    viewportCenter: Point
  ): { dx: number; dy: number; done: boolean } {
    this.snapElapsed += dt;
    const t = Math.min(this.snapElapsed / SNAP_BACK_DURATION_MS, 1);
    const eased = easeOut(t);

    const expectedX =
      this.snapStartX + eased * (this.snapTargetX - this.snapStartX);
    const expectedY =
      this.snapStartY + eased * (this.snapTargetY - this.snapStartY);

    const dx = expectedX - viewportCenter.x;
    const dy = expectedY - viewportCenter.y;

    if (t >= 1) {
      this.state = 'idle';
      return { dx, dy, done: true };
    }

    return { dx, dy, done: false };
  }
}
