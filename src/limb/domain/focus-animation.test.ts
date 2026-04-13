import { describe, it, expect } from 'vitest';
import { planFocusAnimation, sampleFocusAnimation } from './focus-animation';
import type { ZoomState } from './zoom';

describe('planFocusAnimation', () => {
  const layout = new Map([
    ['root', { x: 1, y: 0 }],
    ['child-a', { x: 0, y: 1 }],
    ['child-b', { x: 2, y: 1 }],
  ]);

  const currentZoom: ZoomState = {
    level: 0.3,
    focusPoint: { x: 1, y: 0 },
    viewportSize: { width: 1280, height: 720 },
  };

  it('has a duration of 350ms', () => {
    const plan = planFocusAnimation(currentZoom, 'child-a', layout);
    expect(plan.duration).toBe(350);
  });

  it('starts at the current zoom level', () => {
    const plan = planFocusAnimation(currentZoom, 'child-a', layout);
    expect(plan.startZoom).toBe(0.3);
  });

  it('ends at zoom level 1.0', () => {
    const plan = planFocusAnimation(currentZoom, 'child-a', layout);
    expect(plan.endZoom).toBe(1.0);
  });

  it('starts at the current focus point', () => {
    const plan = planFocusAnimation(currentZoom, 'child-a', layout);
    expect(plan.startFocusPoint).toEqual({ x: 1, y: 0 });
  });

  it('ends at the target node position from layout', () => {
    const plan = planFocusAnimation(currentZoom, 'child-a', layout);
    expect(plan.endFocusPoint).toEqual({ x: 0, y: 1 });
  });

  it('records address bar fade start at 70% of duration', () => {
    const plan = planFocusAnimation(currentZoom, 'child-a', layout);
    expect(plan.addressBarFadeStart).toBe(245);
  });
});

describe('sampleFocusAnimation', () => {
  const layout = new Map([
    ['root', { x: 0, y: 0 }],
    ['target', { x: 10, y: 5 }],
  ]);

  const currentZoom: ZoomState = {
    level: 0.0,
    focusPoint: { x: 0, y: 0 },
    viewportSize: { width: 1280, height: 720 },
  };

  const plan = planFocusAnimation(currentZoom, 'target', layout);

  it('at t=0 returns start values', () => {
    const sample = sampleFocusAnimation(plan, 0);
    expect(sample.zoomLevel).toBe(0.0);
    expect(sample.focusPoint).toEqual({ x: 0, y: 0 });
    expect(sample.addressBarOpacity).toBe(0);
  });

  it('at t=duration returns end values', () => {
    const sample = sampleFocusAnimation(plan, 350);
    expect(sample.zoomLevel).toBe(1.0);
    expect(sample.focusPoint).toEqual({ x: 10, y: 5 });
    expect(sample.addressBarOpacity).toBe(1.0);
  });

  it('address bar opacity is 0 before 70% of duration', () => {
    const sample = sampleFocusAnimation(plan, 200);
    expect(sample.addressBarOpacity).toBe(0);
  });

  it('address bar opacity is 0 at exactly 70% of duration', () => {
    const sample = sampleFocusAnimation(plan, 245);
    expect(sample.addressBarOpacity).toBe(0);
  });

  it('address bar fades in linearly during last 30%', () => {
    // Midpoint of fade window: 245 + (350 - 245) / 2 = 297.5
    const sample = sampleFocusAnimation(plan, 297.5);
    expect(sample.addressBarOpacity).toBeCloseTo(0.5, 5);
  });

  it('address bar opacity is 1.0 at end of animation', () => {
    const sample = sampleFocusAnimation(plan, 350);
    expect(sample.addressBarOpacity).toBe(1.0);
  });

  it('clamps to start values for negative time', () => {
    const sample = sampleFocusAnimation(plan, -10);
    expect(sample.zoomLevel).toBe(0.0);
    expect(sample.addressBarOpacity).toBe(0);
  });

  it('clamps to end values for time beyond duration', () => {
    const sample = sampleFocusAnimation(plan, 500);
    expect(sample.zoomLevel).toBe(1.0);
    expect(sample.addressBarOpacity).toBe(1.0);
  });

  it('applies ease-out: progress ahead of linear at midpoint', () => {
    // Ease-out means animation is front-loaded: at t=50%, progress > 50%
    const sample = sampleFocusAnimation(plan, 175);
    // With ease-out, zoom should be more than halfway from 0.0 to 1.0
    expect(sample.zoomLevel).toBeGreaterThan(0.5);
  });

  it('focus point interpolates with easing', () => {
    const sample = sampleFocusAnimation(plan, 175);
    // Focus should have moved more than halfway due to ease-out
    expect(sample.focusPoint.x).toBeGreaterThan(5);
    expect(sample.focusPoint.y).toBeGreaterThan(2.5);
  });

  it('zoom level increases monotonically', () => {
    const times = [0, 50, 100, 150, 200, 250, 300, 350];
    const levels = times.map(t => sampleFocusAnimation(plan, t).zoomLevel);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  it('interpolates correctly with non-zero start values', () => {
    const nonZeroZoom: ZoomState = {
      level: 0.4,
      focusPoint: { x: 5, y: -3 },
      viewportSize: { width: 1280, height: 720 },
    };
    const nonZeroPlan = planFocusAnimation(nonZeroZoom, 'target', layout);

    const atStart = sampleFocusAnimation(nonZeroPlan, 0);
    expect(atStart.zoomLevel).toBe(0.4);
    expect(atStart.focusPoint).toEqual({ x: 5, y: -3 });

    const atEnd = sampleFocusAnimation(nonZeroPlan, 350);
    expect(atEnd.zoomLevel).toBe(1.0);
    expect(atEnd.focusPoint).toEqual({ x: 10, y: 5 });

    // At midpoint, ease-out means progress > 50%, so values closer to end
    const atMid = sampleFocusAnimation(nonZeroPlan, 175);
    // Zoom must be between start and end, but above linear midpoint (0.7)
    expect(atMid.zoomLevel).toBeGreaterThan(0.7);
    expect(atMid.zoomLevel).toBeLessThan(1.0);
    // Focus point must reflect non-zero start — x should be between 5 and 10
    expect(atMid.focusPoint.x).toBeGreaterThan(5);
    expect(atMid.focusPoint.x).toBeLessThan(10);
    // y should be between -3 and 5
    expect(atMid.focusPoint.y).toBeGreaterThan(-3);
    expect(atMid.focusPoint.y).toBeLessThan(5);
  });
});
