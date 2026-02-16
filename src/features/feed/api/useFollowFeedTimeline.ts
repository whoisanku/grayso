import { useMemo } from "react";
import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";

import {
  fetchFollowFeedHashes,
  fetchPostByPostHash,
  type FocusFeedPost,
} from "@/lib/focus/graphql";
import { feedKeys } from "./keys";

const DEFAULT_PAGE_SIZE = 20;

type TimelinePage = {
  posts: FocusFeedPost[];
  nextOffset: number | null;
  hasMore: boolean;
};

export function useFollowFeedTimeline({
  followerPublicKey,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  followerPublicKey?: string;
  enabled?: boolean;
  pageSize?: number;
}) {
  const query = useInfiniteQuery<
    TimelinePage,
    Error,
    InfiniteData<TimelinePage>,
    ReturnType<typeof feedKeys.timeline>,
    number
  >({
    queryKey: feedKeys.timeline(followerPublicKey ?? ""),
    enabled: Boolean(followerPublicKey) && enabled,
    initialPageParam: 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({ pageParam }) => {
      if (!followerPublicKey) {
        throw new Error("Follower public key is required");
      }

      const result = await fetchFollowFeedHashes({
        followerPublicKey,
        first: pageSize,
        offset: pageParam ?? 0,
      });

      const postHashes = result.nodes
        .map((node) => node.postHash?.trim())
        .filter((hash): hash is string => Boolean(hash));

      const uniqueHashes = Array.from(new Set(postHashes));
      const postEntries = await Promise.allSettled(
        uniqueHashes.map((postHash) => fetchPostByPostHash({ postHash })),
      );

      const byHash = new Map<string, FocusFeedPost>();
      for (let index = 0; index < uniqueHashes.length; index += 1) {
        const entry = postEntries[index];
        const hash = uniqueHashes[index];
        if (entry.status === "fulfilled" && entry.value) {
          byHash.set(hash, entry.value);
        }
      }

      const orderedPosts = postHashes
        .map((hash) => byHash.get(hash))
        .filter((post): post is FocusFeedPost => Boolean(post));

      return {
        posts: orderedPosts,
        nextOffset: result.nextOffset,
        hasMore: Boolean(
          result.pageInfo.hasNextPage && result.nextOffset != null,
        ),
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextOffset ?? undefined) : undefined,
  });

  const posts = useMemo(() => {
    const seenHashes = new Set<string>();
    const flattened: FocusFeedPost[] = [];

    for (const page of query.data?.pages ?? []) {
      for (const post of page.posts) {
        const hash = post.postHash;
        if (!hash || seenHashes.has(hash)) {
          continue;
        }
        seenHashes.add(hash);
        flattened.push(post);
      }
    }

    return flattened;
  }, [query.data?.pages]);

  return {
    posts,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    error: query.error?.message ?? null,
    reload: query.refetch,
    loadMore: query.fetchNextPage,
  };
}
