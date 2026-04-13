export type LODTier = 'culled' | 'favicon' | 'screenshot-low' | 'screenshot-high' | 'live' | 'focused';

export interface LODProbe {
  tierTransitioned(nodeId: string, fromTier: LODTier, toTier: LODTier): void;
  tierAssigned(nodeId: string, tier: LODTier): void;
}
