import { getPostsForUser } from "deso-protocol";
import { useMemo } from "react";
import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";

import {
  fetchPostByPostHash,
  type FocusFeedPost,
} from "@/lib/focus/graphql";
import { profileKeys } from "./keys";

const DEFAULT_PAGE_SIZE = 15;

type ProfilePostsPage = {
  posts: FocusFeedPost[];
  nextCursor: string | null;
  hasMore: boolean;
};

function normalizePostHash(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/^0x/i, "");
  return /^0+$/.test(normalized) ? "" : normalized;
}

function isTopLevelProfilePost(parentStakeId: string | null | undefined): boolean {
  return normalizePostHash(parentStakeId) === "";
}

export function useProfilePosts({
  publicKey,
  username,
  readerPublicKey,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  publicKey?: string;
  username?: string;
  readerPublicKey?: string;
  enabled?: boolean;
  pageSize?: number;
}) {
  const normalizedPublicKey = publicKey?.trim() ?? "";
  const normalizedUsername = username?.trim() ?? "";
  const normalizedReaderPublicKey = readerPublicKey?.trim() ?? "";

  const query = useInfiniteQuery<
    ProfilePostsPage,
    Error,
    InfiniteData<ProfilePostsPage>,
    ReturnType<typeof profileKeys.posts>,
    string
  >({
    queryKey: profileKeys.posts(
      normalizedPublicKey,
      normalizedUsername,
      normalizedReaderPublicKey,
    ),
    enabled: Boolean(normalizedPublicKey || normalizedUsername) && enabled,
    initialPageParam: "",
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({ pageParam }) => {
      const response = await getPostsForUser({
        NumToFetch: pageSize,
        OnlyPosts: true,
        ...(pageParam ? { LastPostHashHex: pageParam } : {}),
        ...(normalizedReaderPublicKey
          ? { ReaderPublicKeyBase58Check: normalizedReaderPublicKey }
          : {}),
        ...(normalizedPublicKey
          ? { PublicKeyBase58Check: normalizedPublicKey }
          : { Username: normalizedUsername }),
      });

      const responsePosts = response.Posts ?? [];
      const postHashes = responsePosts
        .filter(
          (entry) =>
            !entry.IsHidden &&
            isTopLevelProfilePost(entry.ParentStakeID) &&
            Boolean(normalizePostHash(entry.PostHashHex)),
        )
        .map((entry) => normalizePostHash(entry.PostHashHex));

      const uniqueHashes = Array.from(new Set(postHashes));
      const hydratedPosts = await Promise.allSettled(
        uniqueHashes.map((postHash) =>
          fetchPostByPostHash({
            postHash,
            readerPublicKey: normalizedReaderPublicKey,
          }),
        ),
      );

      const byHash = new Map<string, FocusFeedPost>();
      for (let index = 0; index < uniqueHashes.length; index += 1) {
        const entry = hydratedPosts[index];
        const hash = uniqueHashes[index];
        if (entry.status === "fulfilled" && entry.value) {
          byHash.set(hash, entry.value);
        }
      }

      const orderedPosts = postHashes
        .map((hash) => byHash.get(hash))
        .filter((post): post is FocusFeedPost => Boolean(post));

      const nextCursor = normalizePostHash(response.LastPostHashHex);
      const hasMore = Boolean(nextCursor) && responsePosts.length >= pageSize;

      return {
        posts: orderedPosts,
        nextCursor: hasMore ? nextCursor : null,
        hasMore,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
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
