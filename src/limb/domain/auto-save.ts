export class AutoSave {
  private saveCallback: () => void;
  private debounceMs: number;
  private dirty: boolean = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(saveCallback: () => void, debounceMs: number = 2000) {
    this.saveCallback = saveCallback;
    this.debounceMs = debounceMs;
  }

  markDirty(): void {
    this.dirty = true;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
    }
    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.dirty = false;
      this.saveCallback();
    }, this.debounceMs);
  }

  saveNow(): void {
    if (!this.dirty) return;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.dirty = false;
    this.saveCallback();
  }

  dispose(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.dirty = false;
  }
}
