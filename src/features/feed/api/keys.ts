export const feedKeys = {
  base: ["feed"] as const,
  timeline: (followerPublicKey: string) =>
    [...feedKeys.base, "timeline", followerPublicKey] as const,
};
