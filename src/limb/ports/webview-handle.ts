export interface WebViewHandle {
  navigate(url: string): void;
  goBack(): void;
  goForward(): void;
  captureScreenshot(): Uint8Array;
  captureScreenshotAsync(): Promise<string | null>;
  destroy(): void;
  onDidStartLoading: (() => void) | null;
  onDidStopLoading: (() => void) | null;
}

export interface WebViewHandleFactory {
  create(nodeId: string): WebViewHandle;
}
