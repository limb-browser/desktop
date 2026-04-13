import type { LODProbe, LODTier } from '../../ports/lod-probe';

export class FakeLODProbe implements LODProbe {
  readonly transitions: { nodeId: string; fromTier: LODTier; toTier: LODTier }[] = [];
  readonly assignments: { nodeId: string; tier: LODTier }[] = [];

  tierTransitioned(nodeId: string, fromTier: LODTier, toTier: LODTier): void {
    this.transitions.push({ nodeId, fromTier, toTier });
  }

  tierAssigned(nodeId: string, tier: LODTier): void {
    this.assignments.push({ nodeId, tier });
  }
}
