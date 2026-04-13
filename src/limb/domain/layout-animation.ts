type Easing = 'ease-in-out' | 'ease-out';

interface AnimationTrack {
  startTime: number;
  duration: number;
  easing: Easing;
}

interface PositionTrack extends AnimationTrack {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface ValueTrack extends AnimationTrack {
  from: number;
  to: number;
}

export interface NodeAnimation {
  nodeId: string;
  position?: PositionTrack;
  opacity?: ValueTrack;
  edge?: ValueTrack;
}

export interface LayoutAnimation {
  totalDuration: number;
  nodes: NodeAnimation[];
}

export function planAnimation(
  oldLayout: Map<string, { x: number; y: number }>,
  newLayout: Map<string, { x: number; y: number }>,
  addedIds: string[],
  removedIds: string[],
): LayoutAnimation {
  const nodes: NodeAnimation[] = [];

  // §4.2: when nodes are removed, siblings shift after fade completes (150ms)
  // §4.1: when nodes are added, shift starts immediately (0ms)
  const shiftStartTime = removedIds.length > 0 ? 150 : 0;

  const addedSet = new Set(addedIds);
  const removedSet = new Set(removedIds);

  // §4.2: removed nodes fade out (150ms) and edge fades simultaneously
  for (const id of removedIds) {
    nodes.push({
      nodeId: id,
      opacity: {
        from: 1,
        to: 0,
        startTime: 0,
        duration: 150,
        easing: 'ease-out',
      },
      edge: {
        from: 1,
        to: 0,
        startTime: 0,
        duration: 150,
        easing: 'ease-out',
      },
    });
  }

  // §4.1: added nodes fade in (150ms, starting 100ms after shift) and edge draws in (200ms)
  for (const id of addedIds) {
    nodes.push({
      nodeId: id,
      opacity: {
        from: 0,
        to: 1,
        startTime: shiftStartTime + 100,
        duration: 150,
        easing: 'ease-out',
      },
      edge: {
        from: 0,
        to: 1,
        startTime: 0,
        duration: 200,
        easing: 'ease-out',
      },
    });
  }

  // §4.2 / zoom-lod.md §4.2: existing nodes animate from old to new position (200ms, ease-in-out)
  for (const [id, newPos] of newLayout) {
    if (addedSet.has(id)) continue;
    if (removedSet.has(id)) continue;

    const oldPos = oldLayout.get(id);
    if (!oldPos) continue;
    if (oldPos.x === newPos.x && oldPos.y === newPos.y) continue;

    nodes.push({
      nodeId: id,
      position: {
        from: { x: oldPos.x, y: oldPos.y },
        to: { x: newPos.x, y: newPos.y },
        startTime: shiftStartTime,
        duration: 200,
        easing: 'ease-in-out',
      },
    });
  }

  // Compute total duration from all tracks
  let totalDuration = 0;
  for (const node of nodes) {
    if (node.position) {
      const end = node.position.startTime + node.position.duration;
      if (end > totalDuration) totalDuration = end;
    }
    if (node.opacity) {
      const end = node.opacity.startTime + node.opacity.duration;
      if (end > totalDuration) totalDuration = end;
    }
    if (node.edge) {
      const end = node.edge.startTime + node.edge.duration;
      if (end > totalDuration) totalDuration = end;
    }
  }

  return { totalDuration, nodes };
}
