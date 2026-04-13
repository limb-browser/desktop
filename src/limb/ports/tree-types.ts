export type NodeStatus = 'live' | 'screenshot' | 'favicon-only' | 'culled';

export interface TreeNode {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  parentId: string | null;
  childIds: string[];
  status: NodeStatus;
  createdAt: number;
  lastVisitedAt: number;
  descendantCount: number;
}
