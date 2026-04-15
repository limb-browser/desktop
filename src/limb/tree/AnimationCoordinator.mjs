// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {{ tick(deltaMs: number): boolean, cancel(): void }} CoordinatedAnimation
 * @typedef {'user-input' | 'programmatic'} AnimationPriority
 */

/**
 * Central registry for concurrent animations (interaction-feel.md S7.4).
 *
 * - Provides a shared time source so all animations use consistent timing.
 * - Enforces property exclusivity: no two animations drive the same
 *   property simultaneously. Registering on an occupied property
 *   cancels the incumbent.
 * - Priority: user input cancels programmatic animations via
 *   cancelProgrammatic().
 * - Cleanup: completed/cancelled animations are fully removed.
 * - Integrates with FrameScheduler via markDirty to keep the frame
 *   loop alive while animations run.
 */
export class AnimationCoordinator {
  /** @type {Map<string, { animation: CoordinatedAnimation, priority: AnimationPriority }>} */
  #animations = new Map();
  /** @type {() => number} */
  #now;
  /** @type {number | null} */
  #lastTickTime = null;
  /** @type {(() => void) | null} */
  #markDirty;
  /** @type {import('../ports/AnimationCoordinatorProbe').AnimationCoordinatorProbe | null} */
  #probe;

  /**
   * @param {import('../ports/AnimationCoordinatorProbe').AnimationCoordinatorProbe} [probe]
   * @param {{ now?: () => number, markDirty?: () => void }} [options]
   */
  constructor(probe, options) {
    this.#now = options?.now ?? (() => performance.now());
    this.#probe = probe ?? null;
    this.#markDirty = options?.markDirty ?? null;
  }

  /**
   * Register an animation for a given property.
   *
   * If an animation already exists for this property, it is cancelled
   * first (S7.4: no two animations should drive the same property).
   *
   * @param {string} property - The animated property name (e.g., 'zoom', 'layout').
   * @param {CoordinatedAnimation} animation - The animation to register.
   * @param {AnimationPriority} [priority='programmatic'] - Animation priority.
   */
  register(property, animation, priority = 'programmatic') {
    const existing = this.#animations.get(property);
    if (existing) {
      existing.animation.cancel();
      this.#probe?.animationCancelled(property);
    }

    this.#animations.set(property, { animation, priority });
    this.#lastTickTime = this.#now();
    this.#probe?.animationRegistered(property, priority);
    this.#markDirty?.();
  }

  /**
   * Cancel all programmatic animations.
   *
   * Called when user input (scroll, click, drag) should take priority
   * over in-progress programmatic animations (S7.4).
   */
  cancelProgrammatic() {
    for (const [property, entry] of this.#animations) {
      if (entry.priority === 'programmatic') {
        entry.animation.cancel();
        this.#animations.delete(property);
        this.#probe?.animationCancelled(property);
      }
    }
  }

  /**
   * Cancel a single property's animation.
   *
   * Used when code bypasses the coordinator to directly set final state
   * (e.g., degraded-mode skip-to-end) and needs to remove the stale
   * adapter so coordinator.tick() does not overwrite the final state.
   *
   * @param {string} property
   */
  cancel(property) {
    const entry = this.#animations.get(property);
    if (!entry) return;
    entry.animation.cancel();
    this.#animations.delete(property);
    this.#probe?.animationCancelled(property);
  }

  /**
   * Cancel all active animations regardless of priority.
   *
   * Used for edge cases like tree mutation during animation (S7.4).
   */
  cancelAll() {
    for (const [property, entry] of this.#animations) {
      entry.animation.cancel();
      this.#probe?.animationCancelled(property);
    }
    this.#animations.clear();
    this.#lastTickTime = null;
  }

  /**
   * Advance all active animations using the shared time source.
   *
   * Computes a single deltaMs from the shared clock and passes it to
   * every registered animation. Completed animations are removed.
   * Calls markDirty if animations remain active.
   */
  tick() {
    if (this.#animations.size === 0) return;

    const now = this.#now();
    const deltaMs = this.#lastTickTime !== null ? now - this.#lastTickTime : 0;
    this.#lastTickTime = now;

    const completed = [];
    for (const [property, entry] of this.#animations) {
      const done = entry.animation.tick(deltaMs);
      if (done) {
        completed.push(property);
      }
    }

    for (const property of completed) {
      this.#animations.delete(property);
      this.#probe?.animationCompleted(property);
    }

    if (this.#animations.size > 0) {
      this.#markDirty?.();
    }
  }

  /**
   * Return the current time from the shared time source.
   * @returns {number}
   */
  now() {
    return this.#now();
  }

  /** @returns {boolean} */
  get hasActiveAnimations() {
    return this.#animations.size > 0;
  }

  /** @returns {number} */
  get activeCount() {
    return this.#animations.size;
  }

  /**
   * Check if a specific property has an active animation.
   * @param {string} property
   * @returns {boolean}
   */
  isActive(property) {
    return this.#animations.has(property);
  }
}
