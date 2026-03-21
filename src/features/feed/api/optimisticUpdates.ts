import { type InfiniteData, type QueryClient } from "@tanstack/react-query";

import { type FocusPostReactionValue } from "@/features/feed/api/usePostReactionAssociation";
import { feedKeys } from "@/features/feed/api/keys";
import { type FocusFeedPost } from "@/lib/focus/graphql";

type TimelinePage = {
  posts: FocusFeedPost[];
  nextOffset: number | null;
  hasMore: boolean;
};

type ThreadPost = {
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

  return trimmed.replace(/^0x/i, "");
}

function toCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function isInfiniteData(
  value: unknown,
): value is InfiniteData<TimelinePage | ThreadPage> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    pages?: unknown;
    pageParams?: unknown;
  };

  return Array.isArray(candidate.pages) && Array.isArray(candidate.pageParams);
}

function isTimelinePage(page: unknown): page is TimelinePage {
  return (
    Boolean(page) &&
    typeof page === "object" &&
    Array.isArray((page as { posts?: unknown }).posts)
  );
}

function isThreadPage(page: unknown): page is ThreadPage {
  return (
    page != null &&
    typeof page === "object" &&
    Array.isArray((page as { parents?: unknown }).parents) &&
    Array.isArray((page as { comments?: unknown }).comments) &&
    "parent" in page
  );
}

function updateReplyCount(post: FocusFeedPost, delta: number): FocusFeedPost {
  const nextReplyCount = Math.max(0, toCount(post.postStats?.replyCount) + delta);

  return {
    ...post,
    postStats: {
      ...(post.postStats ?? {}),
      replyCount: nextReplyCount,
    },
  };
}

function getViewerReactionValue(
  post: FocusFeedPost,
): FocusPostReactionValue | null {
  const reactionValue = post.viewerReactions?.nodes?.[0]?.associationValue;

  return typeof reactionValue === "string"
    ? (reactionValue as FocusPostReactionValue)
    : null;
}

function getReactionCounts(post: FocusFeedPost) {
  return {
    LIKE: toCount(post.likeReactions?.totalCount ?? post.postStats?.likeReactionCount),
    DISLIKE: toCount(
      post.dislikeReactions?.totalCount ?? post.postStats?.dislikeReactionCount,
    ),
    LOVE: toCount(post.loveReactions?.totalCount ?? post.postStats?.loveReactionCount),
    LAUGH: toCount(
      post.laughReactions?.totalCount ?? post.postStats?.laughReactionCount,
    ),
    SAD: toCount(post.sadReactions?.totalCount),
    CRY: toCount(post.cryReactions?.totalCount ?? post.postStats?.astonishedReactionCount),
    ANGRY: toCount(
      post.angryReactions?.totalCount ?? post.postStats?.angryReactionCount,
    ),
  };
}

function setReactionCount(
  post: FocusFeedPost,
  reactionValue: FocusPostReactionValue,
  nextCount: number,
): FocusFeedPost {
  switch (reactionValue) {
    case "LIKE":
      return {
        ...post,
        likeReactions: {
          ...(post.likeReactions ?? {}),
          totalCount: nextCount,
        },
        postStats: {
          ...(post.postStats ?? {}),
          likeReactionCount: nextCount,
        },
      };
    case "DISLIKE":
      return {
        ...post,
        dislikeReactions: {
          ...(post.dislikeReactions ?? {}),
          totalCount: nextCount,
        },
        postStats: {
          ...(post.postStats ?? {}),
          dislikeReactionCount: nextCount,
        },
      };
    case "LOVE":
      return {
        ...post,
        loveReactions: {
          ...(post.loveReactions ?? {}),
          totalCount: nextCount,
        },
        postStats: {
          ...(post.postStats ?? {}),
          loveReactionCount: nextCount,
        },
      };
    case "LAUGH":
      return {
        ...post,
        laughReactions: {
          ...(post.laughReactions ?? {}),
          totalCount: nextCount,
        },
        postStats: {
          ...(post.postStats ?? {}),
          laughReactionCount: nextCount,
        },
      };
    case "SAD":
      return {
        ...post,
        sadReactions: {
          ...(post.sadReactions ?? {}),
          totalCount: nextCount,
        },
      };
    case "CRY":
      return {
        ...post,
        cryReactions: {
          ...(post.cryReactions ?? {}),
          totalCount: nextCount,
        },
        postStats: {
          ...(post.postStats ?? {}),
          astonishedReactionCount: nextCount,
        },
      };
    case "ANGRY":
      return {
        ...post,
        angryReactions: {
          ...(post.angryReactions ?? {}),
          totalCount: nextCount,
        },
        postStats: {
          ...(post.postStats ?? {}),
          angryReactionCount: nextCount,
        },
      };
  }
}

function buildOptimisticViewerReactions(
  postHash: string,
  reactionValue: FocusPostReactionValue | null,
): FocusFeedPost["viewerReactions"] {
  if (!reactionValue) {
    return {
      nodes: [],
    };
  }

  return {
    nodes: [
      {
        associationId: `optimistic:${postHash}:${reactionValue}`,
        associationType: "REACTION",
        associationValue: reactionValue,
      },
    ],
  };
}

function updateReaction(post: FocusFeedPost, reactionValue: FocusPostReactionValue | null) {
  const previousReactionValue = getViewerReactionValue(post);

  if (previousReactionValue === reactionValue) {
    return post;
  }

  const reactionCounts = getReactionCounts(post);
  let nextPost = post;

  if (previousReactionValue) {
    nextPost = setReactionCount(
      nextPost,
      previousReactionValue,
      Math.max(0, reactionCounts[previousReactionValue] - 1),
    );
  }

  if (reactionValue) {
    const nextBaseCount =
      reactionValue === previousReactionValue
        ? reactionCounts[reactionValue]
        : getReactionCounts(nextPost)[reactionValue];

    nextPost = setReactionCount(nextPost, reactionValue, nextBaseCount + 1);
  }

  const nextReactionCounts = getReactionCounts(nextPost);
  const totalReactionCount = Object.values(nextReactionCounts).reduce(
    (total, count) => total + count,
    0,
  );

  return {
    ...nextPost,
    viewerReactions: buildOptimisticViewerReactions(post.postHash, reactionValue),
    postStats: {
      ...(nextPost.postStats ?? {}),
      totalReactionCount,
    },
  };
}

function patchCachedFeedData(
  cachedData: unknown,
  targetPostHash: string,
  updater: (post: FocusFeedPost) => FocusFeedPost,
  options?: {
    replyCountDelta?: number;
  },
) {
  if (!isInfiniteData(cachedData)) {
    return cachedData;
  }

  let hasChanges = false;
  const normalizedTargetHash = normalizePostHash(targetPostHash);

  const nextPages = cachedData.pages.map((page) => {
    if (isTimelinePage(page)) {
      let pageChanged = false;
      const nextPosts = page.posts.map((post) => {
        if (normalizePostHash(post.postHash) !== normalizedTargetHash) {
          return post;
        }

        pageChanged = true;
        hasChanges = true;
        return updater(post);
      });

      return pageChanged ? { ...page, posts: nextPosts } : page;
    }

    if (isThreadPage(page)) {
      let matchedThread = false;

      const updateThreadPost = (threadPost: ThreadPost): ThreadPost => {
        if (normalizePostHash(threadPost.postHash) !== normalizedTargetHash) {
          return threadPost;
        }

        matchedThread = true;
        hasChanges = true;

        return {
          ...threadPost,
          replyCount:
            options?.replyCountDelta != null
              ? Math.max(0, threadPost.replyCount + options.replyCountDelta)
              : threadPost.replyCount,
          post: updater(threadPost.post),
        };
      };

      const nextParent = page.parent ? updateThreadPost(page.parent) : null;
      const nextParents = page.parents.map(updateThreadPost);
      const nextComments = page.comments.map(updateThreadPost);

      if (!matchedThread) {
        return page;
      }

      return {
        ...page,
        parent: nextParent,
        parents: nextParents,
        comments: nextComments,
        totalCommentCount:
          options?.replyCountDelta != null
            ? Math.max(0, page.totalCommentCount + options.replyCountDelta)
            : page.totalCommentCount,
      };
    }

    return page;
  });

  return hasChanges
    ? {
        ...cachedData,
        pages: nextPages,
      }
    : cachedData;
}

export function applyOptimisticReplyCountUpdate(
  queryClient: QueryClient,
  postHash: string,
  delta: number,
) {
  if (!postHash.trim() || delta === 0) {
    return;
  }

  queryClient.setQueriesData(
    {
      queryKey: feedKeys.base,
    },
    (cachedData) =>
      patchCachedFeedData(
        cachedData,
        postHash,
        (post) => updateReplyCount(post, delta),
        { replyCountDelta: delta },
      ),
  );
}

export function applyOptimisticReactionUpdate(
  queryClient: QueryClient,
  postHash: string,
  reactionValue: FocusPostReactionValue | null,
) {
  if (!postHash.trim()) {
    return;
  }

  queryClient.setQueriesData(
    {
      queryKey: feedKeys.base,
    },
    (cachedData) =>
      patchCachedFeedData(cachedData, postHash, (post) =>
        updateReaction(post, reactionValue),
      ),
  );
}
