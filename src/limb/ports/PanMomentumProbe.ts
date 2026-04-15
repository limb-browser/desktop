// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Observability port for pan momentum state transitions.
 *
 * Domain probes fire at state transitions within the PanMomentum module:
 * idle → momentum, momentum → idle, idle/momentum → snap-back,
 * snap-back → idle, and any → idle (cancel).
 */
export interface PanMomentumProbe {
  /** Momentum started with the given velocity vector (logical-units/ms). */
  momentumStarted(vx: number, vy: number): void;

  /** Momentum stopped because velocity dropped below threshold. */
  momentumStopped(): void;

  /** Snap-back animation started toward the given target (logical coords). */
  snapBackStarted(targetX: number, targetY: number): void;

  /** Snap-back animation completed; viewport is at the target edge. */
  snapBackCompleted(): void;

  /** Momentum or snap-back was cancelled by external input. */
  cancelled(): void;
}
