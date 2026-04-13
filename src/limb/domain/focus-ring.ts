export interface FocusRingState {
  targetNodeId: string;
  visible: boolean;
}

export function computeFocusRing(
  focusedNodeId: string,
  _zoomLevel: number
): FocusRingState {
  return {
    targetNodeId: focusedNodeId,
    visible: true,
  };
}
