import { describe, it, expect } from 'vitest';
import { HoverState, hoverEnter, hoverLeave } from './hover-state';

describe('HoverState', () => {
  it('hover enter sets hovered nodeId and transition start time', () => {
    const state: HoverState = { hoveredNodeId: null, transitionStartTime: null };
    const now = 1000;
    const result = hoverEnter(state, 'node-1', 0.5, now);

    expect(result.hoveredNodeId).toBe('node-1');
    expect(result.transitionStartTime).toBe(1000);
  });

  it('hover leave clears hovered nodeId', () => {
    const state: HoverState = { hoveredNodeId: 'node-1', transitionStartTime: 500 };
    const result = hoverLeave(state);

    expect(result.hoveredNodeId).toBeNull();
    expect(result.transitionStartTime).toBeNull();
  });

  it('only one node can be hovered at a time', () => {
    const state: HoverState = { hoveredNodeId: null, transitionStartTime: null };
    const s1 = hoverEnter(state, 'node-1', 0.5, 1000);
    const s2 = hoverEnter(s1, 'node-2', 0.5, 2000);

    expect(s2.hoveredNodeId).toBe('node-2');
    expect(s2.transitionStartTime).toBe(2000);
  });

  it('hovering only applies when zoomLevel < 0.9 (tree view)', () => {
    const state: HoverState = { hoveredNodeId: null, transitionStartTime: null };

    // At zoomLevel 0.9, hover should not apply
    const atBoundary = hoverEnter(state, 'node-1', 0.9, 1000);
    expect(atBoundary.hoveredNodeId).toBeNull();
    expect(atBoundary.transitionStartTime).toBeNull();

    // At zoomLevel 1.0, hover should not apply
    const above = hoverEnter(state, 'node-1', 1.0, 1000);
    expect(above.hoveredNodeId).toBeNull();
    expect(above.transitionStartTime).toBeNull();

    // At zoomLevel 0.89, hover should apply
    const below = hoverEnter(state, 'node-1', 0.89, 1000);
    expect(below.hoveredNodeId).toBe('node-1');
    expect(below.transitionStartTime).toBe(1000);
  });
});
