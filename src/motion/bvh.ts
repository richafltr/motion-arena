/**
 * BVH normalization boundary, adapted conceptually from the MIT-licensed
 * vrm-c/bvh2vrma project. Real BVH parsing will land behind this interface.
 * See THIRD_PARTY_NOTICES.md for attribution.
 */
export type NormalizedBvhFrame = {
  time: number;
  joints: Record<string, { rotation: [number, number, number, number]; position?: [number, number, number] }>;
};

export type NormalizedBvhMotion = {
  frameTime: number;
  frames: NormalizedBvhFrame[];
};

export function parseBvh(source: string): NormalizedBvhMotion {
  void source;
  throw new Error('BVH parsing is intentionally deferred; use a converted VRMA asset for this milestone.');
}
