import type { PoolProbe } from '../../ports/pool-probe';

export class FakePoolProbe implements PoolProbe {
  readonly acquiredNodeIds: string[] = [];
  readonly evictedNodeIds: string[] = [];
  readonly releasedNodeIds: string[] = [];
  readonly exhaustedCalls: number[] = [];

  webviewAcquired(nodeId: string): void {
    this.acquiredNodeIds.push(nodeId);
  }

  webviewEvicted(nodeId: string): void {
    this.evictedNodeIds.push(nodeId);
  }

  webviewReleased(nodeId: string): void {
    this.releasedNodeIds.push(nodeId);
  }

  poolExhausted(): void {
    this.exhaustedCalls.push(1);
  }
}
