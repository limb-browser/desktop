export type PaintHoldState =
  | 'showing-screenshot'
  | 'loading-behind'
  | 'cross-fading'
  | 'live'
  | 'capturing'
  | 'showing-screenshot-over-live';

export function beginLoading(state: PaintHoldState): PaintHoldState | null {
  if (state !== 'showing-screenshot') return null;
  return 'loading-behind';
}

export function onDidPaint(state: PaintHoldState): PaintHoldState | null {
  if (state !== 'loading-behind') return null;
  return 'cross-fading';
}

export function onCrossFadeComplete(state: PaintHoldState): PaintHoldState | null {
  if (state !== 'cross-fading') return null;
  return 'live';
}

export function beginCapture(state: PaintHoldState): PaintHoldState | null {
  if (state !== 'live') return null;
  return 'capturing';
}

export function onCaptureComplete(state: PaintHoldState): PaintHoldState | null {
  if (state !== 'capturing') return null;
  return 'showing-screenshot-over-live';
}

export function onWebviewDestroyed(state: PaintHoldState): PaintHoldState | null {
  if (state !== 'showing-screenshot-over-live') return null;
  return 'showing-screenshot';
}
