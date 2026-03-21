export const feedKeys = {
  base: ["feed"] as const,
  forYouTimeline: (readerPublicKey: string) =>
    [...feedKeys.base, "timeline", "for-you", readerPublicKey] as const,
  timeline: (followerPublicKey: string, readerPublicKey: string) =>
    [...feedKeys.base, "timeline", followerPublicKey, readerPublicKey] as const,
  postThread: (postHash: string, readerPublicKey: string) =>
    [...feedKeys.base, "post-thread", postHash, readerPublicKey] as const,
  postReactions: (postHash: string) =>
    [...feedKeys.base, "post-reactions", postHash] as const,
  followStatus: (readerPublicKey: string, targetPublicKey: string) =>
    [...feedKeys.base, "follow-status", readerPublicKey, targetPublicKey] as const,
};
