export interface PoolProbe {
  webviewAcquired(nodeId: string): void;
  webviewEvicted(nodeId: string): void;
  webviewReleased(nodeId: string): void;
  poolExhausted(): void;
}
