import type { PoolProbe } from '../ports/pool-probe';
import type { WebViewHandle, WebViewHandleFactory } from '../ports/webview-handle';

export interface PoolConfig {
  maxLive: number;
  screenshotDelay: number;
  preloadMargin: number;
}

export type NodeStatusUpdater = (nodeId: string) => void;

export class WebViewPool {
  active: Map<string, WebViewHandle>;
  pending: Set<string>;
  screenshots: Map<string, Uint8Array>;

  private config: PoolConfig;
  private probe: PoolProbe;
  private factory: WebViewHandleFactory;
  private statusUpdater: NodeStatusUpdater;
  private focusedNodeId: string | null = null;
  private visitOrder: Map<string, number>;
  private visitCounter = 0;
  private pendingUrls: Map<string, string>;
  private lastCapturedAt: Map<string, number>;

  constructor(config: PoolConfig, factory: WebViewHandleFactory, probe: PoolProbe, statusUpdater: NodeStatusUpdater) {
    this.config = config;
    this.factory = factory;
    this.probe = probe;
    this.statusUpdater = statusUpdater;
    this.active = new Map();
    this.pending = new Set();
    this.screenshots = new Map();
    this.visitOrder = new Map();
    this.pendingUrls = new Map();
    this.lastCapturedAt = new Map();
  }

  setFocusedNodeId(nodeId: string | null): void {
    this.focusedNodeId = nodeId;
    if (nodeId !== null && this.active.has(nodeId)) {
      this.visitOrder.set(nodeId, this.visitCounter++);
    }
  }

  acquire(nodeId: string, url: string): void {
    if (this.active.has(nodeId)) {
      return;
    }

    if (this.pending.has(nodeId)) {
      return;
    }

    if (this.active.size >= this.config.maxLive) {
      const evicted = this.evict();
      if (!evicted) {
        this.pending.add(nodeId);
        this.pendingUrls.set(nodeId, url);
        this.probe.poolExhausted();
        return;
      }
    }

    const handle = this.factory.create(nodeId);
    handle.navigate(url);
    this.active.set(nodeId, handle);
    this.visitOrder.set(nodeId, this.visitCounter++);
    this.probe.webviewAcquired(nodeId);
  }

  private evict(): boolean {
    let lruNodeId: string | null = null;
    let lruOrder = Infinity;

    for (const [nodeId] of this.active) {
      if (nodeId === this.focusedNodeId) continue;
      const order = this.visitOrder.get(nodeId) ?? -1;
      if (order < lruOrder) {
        lruNodeId = nodeId;
        lruOrder = order;
      }
    }

    if (lruNodeId === null) return false;

    const handle = this.active.get(lruNodeId)!;
    const screenshot = handle.captureScreenshot();
    this.screenshots.set(lruNodeId, screenshot);
    this.lastCapturedAt.set(lruNodeId, Date.now());
    this.statusUpdater(lruNodeId);
    handle.destroy();
    this.active.delete(lruNodeId);
    this.visitOrder.delete(lruNodeId);
    this.probe.webviewEvicted(lruNodeId);
    return true;
  }

  release(nodeId: string, visible: boolean): void {
    const handle = this.active.get(nodeId);
    if (!handle) return;

    const lastCapture = this.lastCapturedAt.get(nodeId);
    if (visible && (lastCapture === undefined || Date.now() - lastCapture > 1000)) {
      const screenshot = handle.captureScreenshot();
      this.screenshots.set(nodeId, screenshot);
      this.lastCapturedAt.set(nodeId, Date.now());
    }

    handle.destroy();
    this.active.delete(nodeId);
    this.visitOrder.delete(nodeId);
    this.probe.webviewReleased(nodeId);

    this.processPending();
  }

  removeNode(nodeId: string): void {
    const hadActive = this.active.has(nodeId);
    const handle = this.active.get(nodeId);
    if (handle) {
      handle.destroy();
      this.active.delete(nodeId);
      this.visitOrder.delete(nodeId);
    }

    this.pending.delete(nodeId);
    this.pendingUrls.delete(nodeId);
    this.screenshots.delete(nodeId);
    this.lastCapturedAt.delete(nodeId);

    if (hadActive) {
      this.processPending();
    }
  }

  private processPending(): void {
    if (this.pending.size === 0) return;
    if (this.active.size >= this.config.maxLive) return;

    const nextNodeId = this.pending.values().next().value!;
    const url = this.pendingUrls.get(nextNodeId)!;

    this.pending.delete(nextNodeId);
    this.pendingUrls.delete(nextNodeId);

    const handle = this.factory.create(nextNodeId);
    handle.navigate(url);
    this.active.set(nextNodeId, handle);
    this.visitOrder.set(nextNodeId, this.visitCounter++);
    this.probe.webviewAcquired(nextNodeId);
  }
}
