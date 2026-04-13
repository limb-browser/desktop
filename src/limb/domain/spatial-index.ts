export class SpatialIndex {
  cellSize: number;
  cells: Map<string, Set<string>>;
  positions: Map<string, { x: number; y: number }>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.positions = new Map();
  }

  private cellKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  insert(nodeId: string, x: number, y: number): void {
    // If node already exists, remove from old cell first
    this.remove(nodeId);

    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const key = this.cellKey(cx, cy);

    let cell = this.cells.get(key);
    if (!cell) {
      cell = new Set();
      this.cells.set(key, cell);
    }
    cell.add(nodeId);

    this.positions.set(nodeId, { x, y });
  }

  remove(nodeId: string): void {
    const pos = this.positions.get(nodeId);
    if (!pos) return;

    const cx = Math.floor(pos.x / this.cellSize);
    const cy = Math.floor(pos.y / this.cellSize);
    const key = this.cellKey(cx, cy);

    const cell = this.cells.get(key);
    if (cell) {
      cell.delete(nodeId);
      if (cell.size === 0) {
        this.cells.delete(key);
      }
    }

    this.positions.delete(nodeId);
  }

  queryRect(x: number, y: number, width: number, height: number): string[] {
    const result: string[] = [];

    const minCx = Math.floor(x / this.cellSize);
    const maxCx = Math.floor((x + width) / this.cellSize);
    const minCy = Math.floor(y / this.cellSize);
    const maxCy = Math.floor((y + height) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.cells.get(this.cellKey(cx, cy));
        if (cell) {
          for (const nodeId of cell) {
            const pos = this.positions.get(nodeId)!;
            if (
              pos.x >= x &&
              pos.x <= x + width &&
              pos.y >= y &&
              pos.y <= y + height
            ) {
              result.push(nodeId);
            }
          }
        }
      }
    }

    return result;
  }
}
