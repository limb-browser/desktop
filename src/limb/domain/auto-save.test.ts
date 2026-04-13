import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoSave } from './auto-save';

describe('AutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('markDirty followed by waiting the debounce interval triggers the save callback', () => {
    const save = vi.fn();
    const engine = new AutoSave(save, 2000);

    engine.markDirty();
    vi.advanceTimersByTime(2000);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('multiple markDirty calls within the window only trigger one save', () => {
    const save = vi.fn();
    const engine = new AutoSave(save, 2000);

    engine.markDirty();
    engine.markDirty();
    engine.markDirty();
    vi.advanceTimersByTime(2000);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('markDirty resets the timer (save happens 2s after the LAST markDirty)', () => {
    const save = vi.fn();
    const engine = new AutoSave(save, 2000);

    engine.markDirty();
    vi.advanceTimersByTime(1500);
    expect(save).not.toHaveBeenCalled();

    engine.markDirty(); // resets timer
    vi.advanceTimersByTime(1500);
    expect(save).not.toHaveBeenCalled(); // only 1500ms since last markDirty

    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saveNow triggers immediate save if dirty', () => {
    const save = vi.fn();
    const engine = new AutoSave(save, 2000);

    engine.markDirty();
    engine.saveNow();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saveNow is a no-op if not dirty', () => {
    const save = vi.fn();
    const engine = new AutoSave(save, 2000);

    engine.saveNow();

    expect(save).not.toHaveBeenCalled();
  });

  it('saveNow cancels any pending debounce timer', () => {
    const save = vi.fn();
    const engine = new AutoSave(save, 2000);

    engine.markDirty();
    engine.saveNow();
    expect(save).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledTimes(1); // no second call from timer
  });

  it('dispose cancels pending timer without saving', () => {
    const save = vi.fn();
    const engine = new AutoSave(save, 2000);

    engine.markDirty();
    engine.dispose();

    vi.advanceTimersByTime(2000);
    expect(save).not.toHaveBeenCalled();
  });

  it('after save fires, subsequent markDirty starts a new cycle', () => {
    const save = vi.fn();
    const engine = new AutoSave(save, 2000);

    engine.markDirty();
    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledTimes(1);

    engine.markDirty();
    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
