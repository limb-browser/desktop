export type CaptureEvent = 'first-load' | 'title-change' | 'eviction' | 'scroll' | 'dom-mutation';

const CAPTURE_EVENTS: Set<CaptureEvent> = new Set(['first-load', 'title-change', 'eviction']);

export function shouldCapture(event: CaptureEvent): boolean {
  return CAPTURE_EVENTS.has(event);
}
