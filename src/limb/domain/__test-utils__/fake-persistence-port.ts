import { randomUUID } from 'node:crypto';
import type {
  PersistencePort,
  SerializedNode,
  SearchResult,
} from '../../ports/persistence-port';

export class FakePersistencePort implements PersistencePort {
  private nodes = new Map<string, SerializedNode>();
  private screenshots = new Map<string, string>();
  private rootId: string | null = null;

  saveNode(node: SerializedNode): void {
    this.nodes.set(node.id, { ...node, childIds: [...node.childIds] });
  }

  saveBranch(
    _branchRootId: string,
    nodes: SerializedNode[],
    screenshots: Map<string, string>,
  ): void {
    for (const node of nodes) {
      this.saveNode(node);
    }
    for (const [nodeId, dataUrl] of screenshots) {
      this.screenshots.set(nodeId, dataUrl);
    }
  }

  loadBranchRoots(): SerializedNode[] {
    if (this.rootId === null) {
      return [];
    }
    const roots: SerializedNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.parentId === this.rootId) {
        roots.push({ ...node, childIds: [...node.childIds] });
      }
    }
    return roots;
  }

  loadBranch(branchRootId: string): {
    nodes: SerializedNode[];
    screenshots: Map<string, string>;
  } {
    const branchRoot = this.nodes.get(branchRootId);
    if (!branchRoot) {
      return { nodes: [], screenshots: new Map() };
    }

    const result: SerializedNode[] = [];
    const branchScreenshots = new Map<string, string>();
    const queue = [branchRootId];

    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = this.nodes.get(id);
      if (!node) continue;

      result.push({ ...node, childIds: [...node.childIds] });

      const screenshot = this.screenshots.get(id);
      if (screenshot !== undefined) {
        branchScreenshots.set(id, screenshot);
      }

      // Find children by checking parentId
      for (const candidate of this.nodes.values()) {
        if (candidate.parentId === id && !result.some((n) => n.id === candidate.id)) {
          queue.push(candidate.id);
        }
      }
    }

    return { nodes: result, screenshots: branchScreenshots };
  }

  getDescendantCount(nodeId: string): number {
    const node = this.nodes.get(nodeId);
    return node?.descendantCount ?? 0;
  }

  deleteSubtree(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Collect all IDs in the subtree
    const idsToDelete: string[] = [];
    const queue = [nodeId];

    while (queue.length > 0) {
      const id = queue.shift()!;
      const n = this.nodes.get(id);
      if (!n) continue;

      idsToDelete.push(id);

      for (const candidate of this.nodes.values()) {
        if (candidate.parentId === id) {
          queue.push(candidate.id);
        }
      }
    }

    for (const id of idsToDelete) {
      this.nodes.delete(id);
      this.screenshots.delete(id);
    }
  }

  searchNodes(query: string, limit: number): SearchResult[] {
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const node of this.nodes.values()) {
      if (results.length >= limit) break;

      const titleMatch = node.title.toLowerCase().includes(lowerQuery);
      const urlMatch = node.url.toLowerCase().includes(lowerQuery);

      if (titleMatch || urlMatch) {
        const branchRoot = this.findBranchRoot(node.id);
        results.push({
          nodeId: node.id,
          url: node.url,
          title: node.title,
          favicon: node.favicon,
          branchRootId: branchRoot.id,
          branchRootTitle: branchRoot.title,
          lastVisitedAt: node.lastVisitedAt,
        });
      }
    }

    return results;
  }

  evictOldScreenshots(
    maxAgeDays: number,
    excludeBranchId: string | null,
  ): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const excludedIds = new Set<string>();

    if (excludeBranchId !== null) {
      this.collectSubtreeIds(excludeBranchId, excludedIds);
    }

    let evicted = 0;
    for (const [nodeId] of this.screenshots) {
      if (excludedIds.has(nodeId)) continue;

      const node = this.nodes.get(nodeId);
      if (node && node.lastVisitedAt < cutoff) {
        this.screenshots.delete(nodeId);
        evicted++;
      }
    }

    return evicted;
  }

  saveScreenshot(nodeId: string, dataUrl: string): void {
    this.screenshots.set(nodeId, dataUrl);
  }

  loadScreenshot(nodeId: string): string | null {
    return this.screenshots.get(nodeId) ?? null;
  }

  getRootId(): string | null {
    return this.rootId;
  }

  createRoot(): string {
    const id = randomUUID();
    this.rootId = id;
    this.nodes.set(id, {
      id,
      url: 'about::home',
      title: '',
      favicon: null,
      parentId: null,
      childIds: [],
      status: 'root',
      createdAt: Date.now(),
      lastVisitedAt: Date.now(),
      descendantCount: 0,
    });
    return id;
  }

  cleanupOrphans(): void {
    const nodeIds = new Set(this.nodes.keys());
    const toDelete: string[] = [];

    for (const node of this.nodes.values()) {
      // Root node has null parentId -- keep it
      if (node.parentId === null) continue;

      // If parent doesn't exist, it's an orphan
      if (!nodeIds.has(node.parentId)) {
        toDelete.push(node.id);
      }
    }

    for (const id of toDelete) {
      this.nodes.delete(id);
      this.screenshots.delete(id);
    }
  }

  private findBranchRoot(nodeId: string): { id: string; title: string } {
    let current = this.nodes.get(nodeId);
    while (current) {
      if (current.parentId === this.rootId || current.parentId === null) {
        return { id: current.id, title: current.title };
      }
      current = this.nodes.get(current.parentId!);
    }
    return { id: '', title: '' };
  }

  private collectSubtreeIds(rootId: string, ids: Set<string>): void {
    ids.add(rootId);
    for (const node of this.nodes.values()) {
      if (node.parentId === rootId && !ids.has(node.id)) {
        this.collectSubtreeIds(node.id, ids);
      }
    }
  }
}
