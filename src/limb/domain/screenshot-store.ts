export type Resolution = 'low' | 'high';

export class ScreenshotStore {
  private data: Map<string, Map<Resolution, Uint8Array>>;

  constructor() {
    this.data = new Map();
  }

  store(nodeId: string, resolution: Resolution, buffer: Uint8Array): void {
    let resMap = this.data.get(nodeId);
    if (!resMap) {
      resMap = new Map();
      this.data.set(nodeId, resMap);
    }
    resMap.set(resolution, buffer);
  }

  get(nodeId: string, resolution: Resolution): Uint8Array | undefined {
    return this.data.get(nodeId)?.get(resolution);
  }

  remove(nodeId: string): void {
    this.data.delete(nodeId);
  }

  totalSize(): number {
    let size = 0;
    for (const resMap of this.data.values()) {
      for (const buffer of resMap.values()) {
        size += buffer.byteLength;
      }
    }
    return size;
  }
}
