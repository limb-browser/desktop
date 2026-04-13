/**
 * ZoomMomentum — physics model for inertial zoom.
 *
 * Friction: velocity halves every 120ms (exponential decay).
 * Velocity tracking: last 3 scroll events within a 150ms window.
 * Momentum stops below 0.001 zoom-units/ms.
 */

const HALF_LIFE_MS = 120;
const MIN_VELOCITY = 0.001;
const WINDOW_MS = 150;
const MIN_EVENTS_FOR_MOMENTUM = 3;

interface ScrollEvent {
  timestamp: number;
  delta: number;
}

export class ZoomMomentum {
  private events: ScrollEvent[] = [];
  private velocity: number = 0;
  private active: boolean = false;

  /**
   * Records a scroll event. If momentum is active, cancels it (interruption).
   */
  recordScroll(timestamp: number, delta: number): void {
    // New scroll input cancels active momentum
    if (this.active) {
      this.interrupt();
    }

    this.events.push({ timestamp, delta });
    // Keep only the last 3 events
    if (this.events.length > MIN_EVENTS_FOR_MOMENTUM) {
      this.events.shift();
    }
  }

  /**
   * Computes release velocity from recent scroll events.
   * Returns 0 if fewer than 3 events within the 150ms window.
   */
  release(timestamp: number): number {
    // Filter to events within the 150ms window
    const recent = this.events.filter(
      (e) => timestamp - e.timestamp <= WINDOW_MS
    );

    // Need at least 3 events for a sustained gesture
    if (recent.length < MIN_EVENTS_FOR_MOMENTUM) {
      this.velocity = 0;
      this.active = false;
      return 0;
    }

    const totalDelta = recent.reduce((sum, e) => sum + e.delta, 0);
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;

    if (timeSpan === 0) {
      this.velocity = 0;
      this.active = false;
      return 0;
    }

    this.velocity = totalDelta / timeSpan;
    this.active = true;
    this.events = [];
    return this.velocity;
  }

  /**
   * Applies friction for dt milliseconds.
   * Returns the zoom level delta for this tick and whether momentum is done.
   *
   * Friction model: velocity halves every HALF_LIFE_MS (120ms).
   * v(t) = v0 * (0.5)^(t / HALF_LIFE_MS)
   *
   * The level delta for a tick of duration dt:
   * integral of v(t) dt from 0 to dt = v0 * HALF_LIFE_MS / ln(2) * (1 - 0.5^(dt/HALF_LIFE_MS))
   *
   * But for simplicity and testability (velocity halves every 120ms),
   * we use discrete: level = v0 * dt, then v = v0 * decay.
   * This matches the spec's "velocity halves every 120ms" exactly when dt=120.
   */
  tick(dt: number): { level: number; done: boolean } {
    if (!this.active) {
      return { level: 0, done: true };
    }

    // Decay factor: (0.5)^(dt / HALF_LIFE_MS)
    const decay = Math.pow(0.5, dt / HALF_LIFE_MS);

    // New velocity after friction
    const newVelocity = this.velocity * decay;

    // Level delta: average velocity over the interval times dt
    // Average of v0 and v1 = (v0 + v1) / 2 — trapezoidal approximation
    const levelDelta = ((this.velocity + newVelocity) / 2) * dt;

    this.velocity = newVelocity;

    // Check minimum velocity threshold
    if (Math.abs(this.velocity) < MIN_VELOCITY) {
      this.velocity = 0;
      this.active = false;
      return { level: levelDelta, done: true };
    }

    return { level: levelDelta, done: false };
  }

  /**
   * Cancels active momentum immediately.
   */
  interrupt(): void {
    this.velocity = 0;
    this.active = false;
  }
}
