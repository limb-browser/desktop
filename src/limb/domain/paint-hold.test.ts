import { describe, it, expect } from 'vitest';
import {
  PaintHoldState,
  beginLoading,
  onDidPaint,
  onCrossFadeComplete,
  beginCapture,
  onCaptureComplete,
  onWebviewDestroyed,
} from './paint-hold';

describe('PaintHoldState transitions', () => {
  describe('screenshot-to-live (§4.1)', () => {
    it('showing-screenshot -> loading-behind via beginLoading', () => {
      const state: PaintHoldState = 'showing-screenshot';
      const result = beginLoading(state);
      expect(result).toBe('loading-behind');
    });

    it('loading-behind -> cross-fading via onDidPaint', () => {
      const state: PaintHoldState = 'loading-behind';
      const result = onDidPaint(state);
      expect(result).toBe('cross-fading');
    });

    it('cross-fading -> live via onCrossFadeComplete', () => {
      const state: PaintHoldState = 'cross-fading';
      const result = onCrossFadeComplete(state);
      expect(result).toBe('live');
    });
  });

  describe('live-to-screenshot (§4.2)', () => {
    it('live -> capturing via beginCapture', () => {
      const state: PaintHoldState = 'live';
      const result = beginCapture(state);
      expect(result).toBe('capturing');
    });

    it('capturing -> showing-screenshot-over-live via onCaptureComplete', () => {
      const state: PaintHoldState = 'capturing';
      const result = onCaptureComplete(state);
      expect(result).toBe('showing-screenshot-over-live');
    });

    it('showing-screenshot-over-live -> showing-screenshot via onWebviewDestroyed', () => {
      const state: PaintHoldState = 'showing-screenshot-over-live';
      const result = onWebviewDestroyed(state);
      expect(result).toBe('showing-screenshot');
    });

    it('full reverse transition: live -> capturing -> showing-screenshot-over-live -> showing-screenshot', () => {
      let state: PaintHoldState = 'live';
      const s1 = beginCapture(state);
      expect(s1).toBe('capturing');
      const s2 = onCaptureComplete(s1!);
      expect(s2).toBe('showing-screenshot-over-live');
      const s3 = onWebviewDestroyed(s2!);
      expect(s3).toBe('showing-screenshot');
    });
  });

  describe('invalid transitions are rejected', () => {
    it('beginLoading rejects non-showing-screenshot states', () => {
      const invalidStates: PaintHoldState[] = [
        'loading-behind',
        'cross-fading',
        'live',
        'capturing',
        'showing-screenshot-over-live',
      ];
      for (const state of invalidStates) {
        expect(beginLoading(state)).toBeNull();
      }
    });

    it('onDidPaint rejects non-loading-behind states', () => {
      const invalidStates: PaintHoldState[] = [
        'showing-screenshot',
        'cross-fading',
        'live',
        'capturing',
        'showing-screenshot-over-live',
      ];
      for (const state of invalidStates) {
        expect(onDidPaint(state)).toBeNull();
      }
    });

    it('onCrossFadeComplete rejects non-cross-fading states', () => {
      const invalidStates: PaintHoldState[] = [
        'showing-screenshot',
        'loading-behind',
        'live',
        'capturing',
        'showing-screenshot-over-live',
      ];
      for (const state of invalidStates) {
        expect(onCrossFadeComplete(state)).toBeNull();
      }
    });

    it('beginCapture rejects non-live states', () => {
      const invalidStates: PaintHoldState[] = [
        'showing-screenshot',
        'loading-behind',
        'cross-fading',
        'capturing',
        'showing-screenshot-over-live',
      ];
      for (const state of invalidStates) {
        expect(beginCapture(state)).toBeNull();
      }
    });

    it('onCaptureComplete rejects non-capturing states', () => {
      const invalidStates: PaintHoldState[] = [
        'showing-screenshot',
        'loading-behind',
        'cross-fading',
        'live',
        'showing-screenshot-over-live',
      ];
      for (const state of invalidStates) {
        expect(onCaptureComplete(state)).toBeNull();
      }
    });

    it('onWebviewDestroyed rejects non-showing-screenshot-over-live states', () => {
      const invalidStates: PaintHoldState[] = [
        'showing-screenshot',
        'loading-behind',
        'cross-fading',
        'live',
        'capturing',
      ];
      for (const state of invalidStates) {
        expect(onWebviewDestroyed(state)).toBeNull();
      }
    });
  });
});
