import type { WebViewHandle, WebViewHandleFactory } from '../../ports/webview-handle';

export class FakeWebViewHandle implements WebViewHandle {
  navigatedTo: string | null = null;
  screenshotCaptured = false;
  destroyed = false;
  callLog: string[] = [];
  onDidStartLoading: (() => void) | null = null;
  onDidStopLoading: (() => void) | null = null;

  navigate(url: string): void {
    this.callLog.push('navigate');
    this.navigatedTo = url;
  }

  goBack(): void {
    this.callLog.push('goBack');
  }

  goForward(): void {
    this.callLog.push('goForward');
  }

  captureScreenshot(): Uint8Array {
    this.callLog.push('captureScreenshot');
    this.screenshotCaptured = true;
    return new Uint8Array(0);
  }

  async captureScreenshotAsync(): Promise<string | null> {
    this.callLog.push('captureScreenshotAsync');
    return null;
  }

  destroy(): void {
    this.callLog.push('destroy');
    this.destroyed = true;
  }
}

export class FakeWebViewHandleFactory implements WebViewHandleFactory {
  readonly created: FakeWebViewHandle[] = [];
  readonly createdForNodeIds: string[] = [];

  create(nodeId: string): WebViewHandle {
    const handle = new FakeWebViewHandle();
    this.created.push(handle);
    this.createdForNodeIds.push(nodeId);
    return handle;
  }
}
