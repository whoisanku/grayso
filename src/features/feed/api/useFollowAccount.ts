import { useMutation, useQuery } from "@tanstack/react-query";
import { getIsFollowing, updateFollowingStatus } from "deso-protocol";

import { feedKeys } from "@/features/feed/api/keys";

function normalizePublicKey(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export async function fetchIsFollowingAccount({
  readerPublicKey,
  targetPublicKey,
}: {
  readerPublicKey: string;
  targetPublicKey: string;
}): Promise<boolean> {
  const normalizedReader = normalizePublicKey(readerPublicKey);
  const normalizedTarget = normalizePublicKey(targetPublicKey);

  if (!normalizedReader || !normalizedTarget) {
    return false;
  }

  if (normalizedReader === normalizedTarget) {
    return false;
  }

  const response = await getIsFollowing({
    PublicKeyBase58Check: normalizedReader,
    IsFollowingPublicKeyBase58Check: normalizedTarget,
  });

  return Boolean(response?.IsFollowing);
}

export function useIsFollowingAccount({
  readerPublicKey,
  targetPublicKey,
  enabled = true,
}: {
  readerPublicKey?: string | null;
  targetPublicKey?: string | null;
  enabled?: boolean;
}) {
  const normalizedReader = normalizePublicKey(readerPublicKey);
  const normalizedTarget = normalizePublicKey(targetPublicKey);

  const query = useQuery({
    queryKey: feedKeys.followStatus(normalizedReader, normalizedTarget),
    enabled:
      enabled &&
      Boolean(normalizedReader) &&
      Boolean(normalizedTarget) &&
      normalizedReader !== normalizedTarget,
    queryFn: () =>
      fetchIsFollowingAccount({
        readerPublicKey: normalizedReader,
        targetPublicKey: normalizedTarget,
      }),
    staleTime: 20_000,
  });

  return {
    isFollowing: query.data ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export async function setFollowingStatus({
  readerPublicKey,
  targetPublicKey,
  shouldFollow,
}: {
  readerPublicKey: string;
  targetPublicKey: string;
  shouldFollow: boolean;
}) {
  const normalizedReader = normalizePublicKey(readerPublicKey);
  const normalizedTarget = normalizePublicKey(targetPublicKey);

  if (!normalizedReader) {
    throw new Error("Login required.");
  }

  if (!normalizedTarget || normalizedReader === normalizedTarget) {
    throw new Error("This account cannot be followed right now.");
  }

  await updateFollowingStatus({
    FollowerPublicKeyBase58Check: normalizedReader,
    FollowedPublicKeyBase58Check: normalizedTarget,
    IsUnfollow: !shouldFollow,
    MinFeeRateNanosPerKB: 1000,
    TransactionFees: null,
  });

  return shouldFollow;
}

export function useToggleFollowingAccount() {
  return useMutation({
    mutationFn: ({
      readerPublicKey,
      targetPublicKey,
      shouldFollow,
    }: {
      readerPublicKey: string;
      targetPublicKey: string;
      shouldFollow: boolean;
    }) =>
      setFollowingStatus({
        readerPublicKey,
        targetPublicKey,
        shouldFollow,
      }),
  });
}
