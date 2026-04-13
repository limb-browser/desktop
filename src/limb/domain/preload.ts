export function shouldPreload(
  currentWidth: number,
  zoomVelocity: number,
  preloadMargin: number,
  liveThreshold: number
): boolean {
  if (currentWidth >= liveThreshold) return false;
  if (zoomVelocity <= 0) return false;

  const msToThreshold = (liveThreshold - currentWidth) / zoomVelocity;
  return msToThreshold <= preloadMargin;
}
