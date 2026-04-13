export interface HoverState {
  hoveredNodeId: string | null;
  transitionStartTime: number | null;
}

export function hoverEnter(
  state: HoverState,
  nodeId: string,
  zoomLevel: number,
  now: number
): HoverState {
  if (zoomLevel >= 0.9) {
    return state;
  }

  return {
    hoveredNodeId: nodeId,
    transitionStartTime: now,
  };
}

export function hoverLeave(_state: HoverState): HoverState {
  return {
    hoveredNodeId: null,
    transitionStartTime: null,
  };
}
