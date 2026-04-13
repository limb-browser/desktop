export interface InternalPageRenderer {
  canRender(url: string): boolean;
  render(url: string, container: HTMLElement): void;
  destroy(): void;
}
