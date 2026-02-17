import { useMutation } from "@tanstack/react-query";
import { getSinglePost, updateLikeStatus } from "deso-protocol";

const HEX_HASH_PATTERN = /^[0-9a-fA-F]+$/;

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
  if (
    !normalized ||
    !HEX_HASH_PATTERN.test(normalized) ||
    normalized.length % 2 !== 0
  ) {
    throw new Error("This post cannot be liked right now.");
  }

  return normalized;
}

export async function fetchReaderLikeState({
  readerPublicKey,
  postHash,
}: {
  readerPublicKey: string;
  postHash: string;
}): Promise<boolean> {
  if (!readerPublicKey.trim()) {
    throw new Error("Login required.");
  }

  const normalizedPostHash = assertValidPostHash(postHash);
  const response = await getSinglePost({
    PostHashHex: normalizedPostHash,
    ReaderPublicKeyBase58Check: readerPublicKey,
    CommentLimit: 0,
    CommentOffset: 0,
    FetchParents: false,
    ThreadLevelLimit: 0,
    ThreadLeafLimit: 0,
    LoadAuthorThread: false,
    AddGlobalFeedBool: false,
  });

  return Boolean(response?.PostFound?.PostEntryReaderState?.LikedByReader);
}

export async function togglePostLike({
  readerPublicKey,
  postHash,
  isUnlike,
}: {
  readerPublicKey: string;
  postHash: string;
  isUnlike: boolean;
}) {
  if (!readerPublicKey.trim()) {
    throw new Error("Login required.");
  }

  const normalizedPostHash = assertValidPostHash(postHash);
  return updateLikeStatus({
    ReaderPublicKeyBase58Check: readerPublicKey,
    LikedPostHashHex: normalizedPostHash,
    IsUnlike: isUnlike,
  });
}

export function useTogglePostLike() {
  return useMutation({
    mutationFn: togglePostLike,
  });
}
