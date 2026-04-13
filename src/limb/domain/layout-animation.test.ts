import { describe, it, expect } from 'vitest';
import { planAnimation } from './layout-animation';
import type { LayoutAnimation, NodeAnimation } from './layout-animation';

function findNode(animation: LayoutAnimation, nodeId: string): NodeAnimation | undefined {
  return animation.nodes.find(n => n.nodeId === nodeId);
}

describe('planAnimation', () => {
  describe('single add', () => {
    const oldLayout = new Map([
      ['root', { x: 0, y: 0 }],
      ['child-a', { x: 0, y: 1 }],
    ]);

    const newLayout = new Map([
      ['root', { x: 0.5, y: 0 }],
      ['child-a', { x: 0, y: 1 }],
      ['child-b', { x: 1, y: 1 }],
    ]);

    const result = planAnimation(oldLayout, newLayout, ['child-b'], []);

    it('shift duration is 200ms with ease-in-out', () => {
      const rootAnim = findNode(result, 'root');
      expect(rootAnim).toBeDefined();
      expect(rootAnim!.position).toBeDefined();
      expect(rootAnim!.position!.duration).toBe(200);
      expect(rootAnim!.position!.easing).toBe('ease-in-out');
    });

    it('shift starts at 0ms for additions', () => {
      const rootAnim = findNode(result, 'root');
      expect(rootAnim!.position!.startTime).toBe(0);
    });

    it('existing node animates from old to new position', () => {
      const rootAnim = findNode(result, 'root');
      expect(rootAnim!.position!.from).toEqual({ x: 0, y: 0 });
      expect(rootAnim!.position!.to).toEqual({ x: 0.5, y: 0 });
    });

    it('fade-in starts at 100ms after shift begins', () => {
      const added = findNode(result, 'child-b');
      expect(added).toBeDefined();
      expect(added!.opacity).toBeDefined();
      expect(added!.opacity!.startTime).toBe(100);
    });

    it('fade-in lasts 150ms with ease-out', () => {
      const added = findNode(result, 'child-b');
      expect(added!.opacity!.duration).toBe(150);
      expect(added!.opacity!.easing).toBe('ease-out');
      expect(added!.opacity!.from).toBe(0);
      expect(added!.opacity!.to).toBe(1);
    });

    it('edge draws in over 200ms with ease-out', () => {
      const added = findNode(result, 'child-b');
      expect(added!.edge).toBeDefined();
      expect(added!.edge!.duration).toBe(200);
      expect(added!.edge!.easing).toBe('ease-out');
      expect(added!.edge!.from).toBe(0);
      expect(added!.edge!.to).toBe(1);
    });

    it('total duration is <= 400ms', () => {
      expect(result.totalDuration).toBeLessThanOrEqual(400);
    });

    it('total duration accounts for fade-in ending at 250ms', () => {
      // shift ends at 200ms, fade-in ends at 100+150=250ms, edge ends at 200ms
      expect(result.totalDuration).toBe(250);
    });
  });

  describe('single remove', () => {
    const oldLayout = new Map([
      ['root', { x: 0.5, y: 0 }],
      ['child-a', { x: 0, y: 1 }],
      ['child-b', { x: 1, y: 1 }],
    ]);

    const newLayout = new Map([
      ['root', { x: 0, y: 0 }],
      ['child-a', { x: 0, y: 1 }],
    ]);

    const result = planAnimation(oldLayout, newLayout, [], ['child-b']);

    it('fade-out lasts 150ms', () => {
      const removed = findNode(result, 'child-b');
      expect(removed).toBeDefined();
      expect(removed!.opacity).toBeDefined();
      expect(removed!.opacity!.from).toBe(1);
      expect(removed!.opacity!.to).toBe(0);
      expect(removed!.opacity!.duration).toBe(150);
      expect(removed!.opacity!.startTime).toBe(0);
    });

    it('edge fades simultaneously with node', () => {
      const removed = findNode(result, 'child-b');
      expect(removed!.edge).toBeDefined();
      expect(removed!.edge!.from).toBe(1);
      expect(removed!.edge!.to).toBe(0);
      expect(removed!.edge!.duration).toBe(150);
      expect(removed!.edge!.startTime).toBe(0);
    });

    it('shift starts after fade completes (at 150ms)', () => {
      const rootAnim = findNode(result, 'root');
      expect(rootAnim).toBeDefined();
      expect(rootAnim!.position).toBeDefined();
      expect(rootAnim!.position!.startTime).toBe(150);
    });

    it('shift duration is 200ms with ease-in-out', () => {
      const rootAnim = findNode(result, 'root');
      expect(rootAnim!.position!.duration).toBe(200);
      expect(rootAnim!.position!.easing).toBe('ease-in-out');
    });

    it('total duration is <= 400ms', () => {
      expect(result.totalDuration).toBeLessThanOrEqual(400);
    });

    it('total duration is 350ms (150ms fade + 200ms shift)', () => {
      expect(result.totalDuration).toBe(350);
    });
  });

  describe('batch of 5 adds', () => {
    const oldLayout = new Map([
      ['root', { x: 0, y: 0 }],
    ]);

    const newLayout = new Map([
      ['root', { x: 2, y: 0 }],
      ['add-1', { x: 0, y: 1 }],
      ['add-2', { x: 1, y: 1 }],
      ['add-3', { x: 2, y: 1 }],
      ['add-4', { x: 3, y: 1 }],
      ['add-5', { x: 4, y: 1 }],
    ]);

    const addedIds = ['add-1', 'add-2', 'add-3', 'add-4', 'add-5'];
    const result = planAnimation(oldLayout, newLayout, addedIds, []);

    it('all animations are concurrent (same timings)', () => {
      for (const id of addedIds) {
        const anim = findNode(result, id);
        expect(anim).toBeDefined();
        expect(anim!.opacity!.startTime).toBe(100);
        expect(anim!.opacity!.duration).toBe(150);
        expect(anim!.edge!.startTime).toBe(0);
        expect(anim!.edge!.duration).toBe(200);
      }
    });

    it('total duration is <= 400ms', () => {
      expect(result.totalDuration).toBeLessThanOrEqual(400);
    });

    it('total duration is same as single add (250ms)', () => {
      expect(result.totalDuration).toBe(250);
    });
  });

  describe('existing nodes animate from old to new position', () => {
    const oldLayout = new Map([
      ['root', { x: 5, y: 0 }],
      ['child-a', { x: 3, y: 1 }],
      ['child-b', { x: 7, y: 1 }],
    ]);

    const newLayout = new Map([
      ['root', { x: 5, y: 0 }],
      ['child-a', { x: 2, y: 1 }],
      ['child-b', { x: 8, y: 1 }],
      ['child-c', { x: 5, y: 1 }],
    ]);

    const result = planAnimation(oldLayout, newLayout, ['child-c'], []);

    it('moved nodes have position animation from old to new', () => {
      const childA = findNode(result, 'child-a');
      expect(childA).toBeDefined();
      expect(childA!.position).toBeDefined();
      expect(childA!.position!.from).toEqual({ x: 3, y: 1 });
      expect(childA!.position!.to).toEqual({ x: 2, y: 1 });
    });

    it('another moved node animates correctly', () => {
      const childB = findNode(result, 'child-b');
      expect(childB).toBeDefined();
      expect(childB!.position).toBeDefined();
      expect(childB!.position!.from).toEqual({ x: 7, y: 1 });
      expect(childB!.position!.to).toEqual({ x: 8, y: 1 });
    });

    it('position animation uses 200ms ease-in-out', () => {
      const childA = findNode(result, 'child-a');
      expect(childA!.position!.duration).toBe(200);
      expect(childA!.position!.easing).toBe('ease-in-out');
    });

    it('unmoved nodes are not included', () => {
      const root = findNode(result, 'root');
      expect(root).toBeUndefined();
    });
  });

  describe('no animation when layout unchanged', () => {
    const layout = new Map([
      ['root', { x: 0, y: 0 }],
      ['child-a', { x: 0, y: 1 }],
    ]);

    const result = planAnimation(layout, layout, [], []);

    it('has no node animations', () => {
      expect(result.nodes).toHaveLength(0);
    });

    it('has zero total duration', () => {
      expect(result.totalDuration).toBe(0);
    });
  });

  describe('mixed batch (adds and removes)', () => {
    const oldLayout = new Map([
      ['root', { x: 1, y: 0 }],
      ['child-a', { x: 0, y: 1 }],
      ['child-b', { x: 2, y: 1 }],
    ]);

    const newLayout = new Map([
      ['root', { x: 0.5, y: 0 }],
      ['child-a', { x: 0, y: 1 }],
      ['child-c', { x: 1, y: 1 }],
    ]);

    const result = planAnimation(oldLayout, newLayout, ['child-c'], ['child-b']);

    it('removed node fades out', () => {
      const removed = findNode(result, 'child-b');
      expect(removed).toBeDefined();
      expect(removed!.opacity!.from).toBe(1);
      expect(removed!.opacity!.to).toBe(0);
    });

    it('added node fades in', () => {
      const added = findNode(result, 'child-c');
      expect(added).toBeDefined();
      expect(added!.opacity!.from).toBe(0);
      expect(added!.opacity!.to).toBe(1);
    });

    it('existing moved node has position animation', () => {
      const root = findNode(result, 'root');
      expect(root).toBeDefined();
      expect(root!.position).toBeDefined();
      expect(root!.position!.from).toEqual({ x: 1, y: 0 });
      expect(root!.position!.to).toEqual({ x: 0.5, y: 0 });
    });

    it('shift starts at 150ms when removes are present', () => {
      const root = findNode(result, 'root');
      expect(root!.position!.startTime).toBe(150);
    });

    it('total duration is <= 400ms', () => {
      expect(result.totalDuration).toBeLessThanOrEqual(400);
    });
  });
});
