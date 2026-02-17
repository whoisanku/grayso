import { useQuery } from "@tanstack/react-query";

import { feedKeys } from "@/features/feed/api/keys";
import {
  FOCUS_POST_REACTION_OPTIONS,
  type FocusPostReactionValue,
} from "@/features/feed/api/usePostReactionAssociation";
import {
  fetchPostByPostHashReactionList,
  type FocusPostReactionAssociationNode,
} from "@/lib/focus/graphql";
import { getValidHttpUrl, toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { getProfileImageUrl } from "@/utils/deso";

const REACTION_VALUE_SET = new Set<FocusPostReactionValue>(
  FOCUS_POST_REACTION_OPTIONS.map((option) => option.value),
);

export type PostReactionItem = {
  associationId: string;
  reactionValue: FocusPostReactionValue;
  publicKey: string;
  username: string;
  displayName: string;
  avatarUri: string | null;
  totalBalanceUsdCents: number;
  totalFollowers: number;
};

function normalizePostHash(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("0x") || trimmed.startsWith("0X")
    ? trimmed.slice(2)
    : trimmed;
}

function assertValidPostHash(postHash: string): string {
  const normalized = normalizePostHash(postHash);
  if (!normalized) {
    throw new Error("This post cannot be opened right now.");
  }

  return normalized;
}

function isFocusPostReactionValue(
  value: unknown,
): value is FocusPostReactionValue {
  return (
    typeof value === "string" &&
    REACTION_VALUE_SET.has(value as FocusPostReactionValue)
  );
}

function readExtraDataString(
  extraData: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = extraData?.[key];
  return typeof value === "string" ? value : null;
}

function normalizeDisplayName(rawValue: string | null | undefined, username: string) {
  if (!rawValue) {
    return username;
  }

  const normalized = rawValue
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized === "@") {
    return username;
  }

  const lower = normalized.toLowerCase();
  if (lower === "null" || lower === "undefined") {
    return username;
  }

  return normalized;
}

function formatShortPublicKey(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function toNonNegativeInt(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function mapReactionNodeToItem(
  association: FocusPostReactionAssociationNode,
): PostReactionItem | null {
  const associationId = association.associationId?.trim();
  const reactionValue = association.associationValue?.trim();
  const transactor = association.transactor;
  const publicKey = transactor?.publicKey?.trim();

  if (!associationId || !publicKey || !isFocusPostReactionValue(reactionValue)) {
    return null;
  }

  const username = transactor?.username?.trim() || formatShortPublicKey(publicKey);
  const displayName = normalizeDisplayName(
    readExtraDataString(transactor?.extraData, "DisplayName"),
    username,
  );

  const largeProfilePic =
    getValidHttpUrl(readExtraDataString(transactor?.extraData, "LargeProfilePicURL")) ??
    getValidHttpUrl(readExtraDataString(transactor?.extraData, "LargeProfilePicUrl"));
  const generatedProfilePic = getValidHttpUrl(getProfileImageUrl(publicKey));
  const avatarUriRaw = largeProfilePic ?? generatedProfilePic ?? null;
  const avatarUri = avatarUriRaw
    ? (toPlatformSafeImageUrl(avatarUriRaw) ?? avatarUriRaw)
    : null;

  return {
    associationId,
    reactionValue,
    publicKey,
    username,
    displayName,
    avatarUri,
    totalBalanceUsdCents: toNonNegativeInt(transactor?.totalBalanceUsdCents),
    totalFollowers: toNonNegativeInt(transactor?.followerCounts?.totalFollowers),
  };
}

export type PostReactionListResult = {
  reactions: PostReactionItem[];
  totalCount: number;
};

export async function fetchPostReactions({
  postHash,
  limit = 120,
  reactionValue = null,
}: {
  postHash: string;
  limit?: number;
  reactionValue?: FocusPostReactionValue | null;
}): Promise<PostReactionListResult> {
  const normalizedPostHash = assertValidPostHash(postHash);
  const response = await fetchPostByPostHashReactionList({
    postHash: normalizedPostHash,
    first: Math.max(1, Math.min(200, Math.floor(limit))),
    offset: 0,
    reactionValue,
  });

  const deduped = new Map<string, PostReactionItem>();

  for (const association of response.nodes) {
    const mapped = mapReactionNodeToItem(association);
    if (!mapped) {
      continue;
    }
    deduped.set(mapped.associationId, mapped);
  }

  return {
    reactions: Array.from(deduped.values()),
    totalCount: toNonNegativeInt(response.totalCount),
  };
}

export function usePostReactions({
  postHash,
  enabled = true,
  limit = 120,
  reactionValue = null,
}: {
  postHash?: string | null;
  enabled?: boolean;
  limit?: number;
  reactionValue?: FocusPostReactionValue | null;
}) {
  const normalizedPostHash = normalizePostHash(postHash ?? "");

  const query = useQuery({
    queryKey: [
      ...feedKeys.postReactions(normalizedPostHash),
      limit,
      reactionValue ?? "ALL",
    ],
    enabled: enabled && Boolean(normalizedPostHash),
    queryFn: () =>
      fetchPostReactions({
        postHash: normalizedPostHash,
        limit,
        reactionValue,
      }),
    staleTime: 20_000,
  });

  return {
    reactions: query.data?.reactions ?? [],
    totalCount: query.data?.totalCount ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
