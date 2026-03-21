import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { feedKeys } from "@/features/feed/api/keys";
import {
  fetchPostByPostHash,
  fetchPostThreadPageByPostHash,
  type FocusFeedPost,
} from "@/lib/focus/graphql";

const DEFAULT_PAGE_SIZE = 8;
const MAX_PARENT_CHAIN_DEPTH = 6;
const HEX_HASH_PATTERN = /^[0-9a-fA-F]+$/;
const MOST_VALUABLE_ORDER = [
  "UPVOTE_CAPPED_WEALTH_USD_CENTS_DESC",
  "TIMESTAMP_DESC",
] as const;
const MOST_RECENT_ORDER = ["TIMESTAMP_DESC"] as const;

export type PostThreadSortMode = "valuable" | "recent";

export type ThreadPost = {
  postHash: string;
  parentPostHash: string | null;
  rootPostHash: string | null;
  commentDepth: number;
  replyCount: number;
  post: FocusFeedPost;
};

type ThreadPage = {
  parents: ThreadPost[];
  parent: ThreadPost | null;
  comments: ThreadPost[];
  nextOffset: number | null;
  totalCommentCount: number;
};

function normalizePostHash(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("0x") || trimmed.startsWith("0X")
    ? trimmed.slice(2)
    : trimmed;
}

function assertValidPostHash(postHash: string): string {
  const normalized = normalizePostHash(postHash);

  if (
    !normalized ||
    !HEX_HASH_PATTERN.test(normalized) ||
    normalized.length % 2 !== 0
  ) {
    throw new Error("This post cannot be opened right now.");
  }

  return normalized;
}

function toCount(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function mapFocusPostToThreadPost(post: FocusFeedPost): ThreadPost | null {
  const postHash = normalizePostHash(post.postHash);

  if (!postHash) {
    return null;
  }

  return {
    postHash,
    parentPostHash: normalizePostHash(post.parentPostHash) || null,
    rootPostHash: normalizePostHash(post.rootPostHash) || null,
    commentDepth: toCount(post.commentDepth),
    replyCount: toCount(post.postStats?.replyCount),
    post,
  };
}

async function fetchParentChain({
  post,
  readerPublicKey,
}: {
  post: FocusFeedPost;
  readerPublicKey: string;
}) {
  const parents: ThreadPost[] = [];
  const seenHashes = new Set<string>([normalizePostHash(post.postHash)]);
  let currentParentHash = normalizePostHash(post.parentPostHash);

  while (
    currentParentHash &&
    parents.length < MAX_PARENT_CHAIN_DEPTH &&
    !seenHashes.has(currentParentHash)
  ) {
    seenHashes.add(currentParentHash);

    const parentPost = await fetchPostByPostHash({
      postHash: currentParentHash,
      readerPublicKey,
    });

    if (!parentPost) {
      break;
    }

    const mappedParent = mapFocusPostToThreadPost(parentPost);
    if (!mappedParent) {
      break;
    }

    parents.unshift(mappedParent);
    currentParentHash = normalizePostHash(parentPost.parentPostHash);
  }

  return parents;
}

async function fetchThreadPage({
  postHash,
  readerPublicKey,
  offset,
  pageSize,
  includeParents,
  sortMode,
}: {
  postHash: string;
  readerPublicKey: string;
  offset: number;
  pageSize: number;
  includeParents: boolean;
  sortMode: PostThreadSortMode;
}): Promise<ThreadPage> {
  const normalizedPostHash = assertValidPostHash(postHash);
  const threadPage = await fetchPostThreadPageByPostHash({
    postHash: normalizedPostHash,
    readerPublicKey,
    first: pageSize,
    offset,
    orderBy: sortMode === "recent" ? [...MOST_RECENT_ORDER] : [...MOST_VALUABLE_ORDER],
  });

  const parent = threadPage.post ? mapFocusPostToThreadPost(threadPage.post) : null;
  const parents =
    offset === 0 && includeParents && threadPage.post
      ? await fetchParentChain({
          post: threadPage.post,
          readerPublicKey,
        })
      : [];
  const comments = threadPage.replies
    .map((reply) => mapFocusPostToThreadPost(reply))
    .filter((reply): reply is ThreadPost => Boolean(reply));

  return {
    parents,
    parent,
    comments,
    nextOffset: threadPage.nextOffset,
    totalCommentCount: threadPage.totalCount,
  };
}

export function usePostThread({
  postHash,
  readerPublicKey,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
  includeParents = true,
  sortMode = "valuable",
}: {
  postHash?: string | null;
  readerPublicKey?: string | null;
  enabled?: boolean;
  pageSize?: number;
  includeParents?: boolean;
  sortMode?: PostThreadSortMode;
}) {
  const normalizedPostHash = normalizePostHash(postHash ?? "");
  const normalizedReaderPublicKey = readerPublicKey?.trim() ?? "";

  const query = useInfiniteQuery({
    queryKey: [
      ...feedKeys.postThread(normalizedPostHash, normalizedReaderPublicKey),
      includeParents ? "parents" : "no-parents",
      sortMode,
    ] as const,
    enabled: enabled && Boolean(normalizedPostHash),
    initialPageParam: 0,
    staleTime: 15_000,
    queryFn: ({ pageParam }) =>
      fetchThreadPage({
        postHash: normalizedPostHash,
        readerPublicKey: normalizedReaderPublicKey,
        offset: pageParam,
        pageSize,
        includeParents,
        sortMode,
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
  });

  const parents = useMemo(() => {
    const firstPage = query.data?.pages[0];
    return firstPage?.parents ?? [];
  }, [query.data?.pages]);

  const post = useMemo(() => {
    for (const page of query.data?.pages ?? []) {
      if (page.parent) {
        return page.parent;
      }
    }

    return null;
  }, [query.data?.pages]);

  const comments = useMemo(() => {
    const seenHashes = new Set<string>();
    const flattened: ThreadPost[] = [];

    for (const page of query.data?.pages ?? []) {
      for (const comment of page.comments) {
        if (!comment.postHash || seenHashes.has(comment.postHash)) {
          continue;
        }

        seenHashes.add(comment.postHash);
        flattened.push(comment);
      }
    }

    return flattened;
  }, [query.data?.pages]);

  const firstPage = query.data?.pages[0] ?? null;
  const totalCommentCount = post?.replyCount ?? firstPage?.totalCommentCount ?? 0;

  return {
    parents,
    post,
    comments,
    totalCommentCount,
    loadedCommentCount: comments.length,
    hasNextPage: Boolean(query.hasNextPage),
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error instanceof Error ? query.error.message : null,
    reload: query.refetch,
    loadMore: query.fetchNextPage,
    sortMode,
  };
}
