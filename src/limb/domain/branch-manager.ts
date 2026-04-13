import type { PersistencePort, SerializedNode } from '../ports/persistence-port';
import type { TreeProbe } from '../ports/tree-probe';
import type { TreeNode, NodeStatus } from './tree-node';
import { BrowsingTree } from './browsing-tree';
import type { ScreenshotStore } from './screenshot-store';

export class BranchManager {
  activeBranchId: string | null = null;

  initialize(persistence: PersistencePort, treeProbe: TreeProbe): { tree: BrowsingTree } {
    let rootId = persistence.getRootId();
    if (rootId === null) {
      rootId = persistence.createRoot();
    }

    // Construct the root node
    const rootNode: TreeNode = {
      id: rootId,
      url: 'about::home',
      title: '',
      favicon: null,
      parentId: null,
      childIds: [],
      status: 'culled' as NodeStatus,
      createdAt: Date.now(),
      lastVisitedAt: Date.now(),
      descendantCount: 0,
    };

    const nodes = new Map<string, TreeNode>();
    nodes.set(rootId, rootNode);
    const tree = BrowsingTree.reconstruct(rootId, nodes, rootId, treeProbe);

    // Load branch roots and add them to the tree
    const branchRoots = persistence.loadBranchRoots();
    for (const serialized of branchRoots) {
      const node: TreeNode = {
        id: serialized.id,
        url: serialized.url,
        title: serialized.title,
        favicon: serialized.favicon,
        parentId: rootId,
        childIds: [],
        status: 'culled' as NodeStatus,
        createdAt: serialized.createdAt,
        lastVisitedAt: serialized.lastVisitedAt,
        descendantCount: serialized.descendantCount,
      };
      tree.addExistingNode(node);
    }

    return { tree };
  }

  createBranch(tree: BrowsingTree, homeUrl: string, persistence: PersistencePort): TreeNode {
    const child = tree.addChild(tree.rootId, homeUrl);

    const serialized: SerializedNode = {
      id: child.id,
      url: child.url,
      title: child.title,
      favicon: child.favicon,
      parentId: child.parentId,
      childIds: [...child.childIds],
      status: child.status,
      createdAt: child.createdAt,
      lastVisitedAt: child.lastVisitedAt,
      descendantCount: child.descendantCount,
    };
    persistence.saveNode(serialized);

    return child;
  }

  deleteBranch(tree: BrowsingTree, branchRootId: string, persistence: PersistencePort): void {
    tree.removeNode(branchRootId);
    persistence.deleteSubtree(branchRootId);
  }

  activateBranch(
    tree: BrowsingTree,
    branchRootId: string,
    persistence: PersistencePort,
    screenshotStore: ScreenshotStore,
  ): void {
    if (this.activeBranchId !== null) {
      this.deactivateBranch(tree, persistence, screenshotStore);
    }

    const { nodes: serializedNodes, screenshots } = persistence.loadBranch(branchRootId);

    // Convert SerializedNode[] to TreeNode[]
    const treeNodes: TreeNode[] = serializedNodes.map(sn => ({
      id: sn.id,
      url: sn.url,
      title: sn.title,
      favicon: sn.favicon,
      parentId: sn.parentId,
      childIds: [...sn.childIds],
      status: sn.status as NodeStatus,
      createdAt: sn.createdAt,
      lastVisitedAt: sn.lastVisitedAt,
      descendantCount: sn.descendantCount,
    }));

    tree.loadSubtree(treeNodes);

    // Load screenshots into ScreenshotStore
    const encoder = new TextEncoder();
    for (const [nodeId, dataUrl] of screenshots) {
      screenshotStore.store(nodeId, 'low', encoder.encode(dataUrl));
    }

    this.activeBranchId = branchRootId;
    tree.focusNode(branchRootId);
  }

  deactivateBranch(
    tree: BrowsingTree,
    persistence: PersistencePort,
    screenshotStore: ScreenshotStore,
  ): void {
    if (this.activeBranchId === null) {
      return;
    }

    const branchRootId = this.activeBranchId;

    // Collect all nodes in the branch (including branch root) before unloading
    const descendants = tree.getDescendants(branchRootId);

    // Serialize nodes
    const serializedNodes: SerializedNode[] = descendants.map(node => ({
      id: node.id,
      url: node.url,
      title: node.title,
      favicon: node.favicon,
      parentId: node.parentId,
      childIds: [...node.childIds],
      status: node.status,
      createdAt: node.createdAt,
      lastVisitedAt: node.lastVisitedAt,
      descendantCount: node.descendantCount,
    }));

    // Collect screenshots from ScreenshotStore
    const decoder = new TextDecoder();
    const screenshots = new Map<string, string>();
    for (const node of descendants) {
      const buffer = screenshotStore.get(node.id, 'low');
      if (buffer) {
        screenshots.set(node.id, decoder.decode(buffer));
      } else {
        const highBuffer = screenshotStore.get(node.id, 'high');
        if (highBuffer) {
          screenshots.set(node.id, decoder.decode(highBuffer));
        }
      }
    }

    // Save to persistence
    persistence.saveBranch(branchRootId, serializedNodes, screenshots);

    // Unload the subtree (remove descendants, keep branch root)
    tree.unloadSubtree(branchRootId);

    // Free screenshots for removed nodes (not the branch root)
    for (const node of descendants) {
      if (node.id !== branchRootId) {
        screenshotStore.remove(node.id);
      }
    }

    this.activeBranchId = null;
  }
}
