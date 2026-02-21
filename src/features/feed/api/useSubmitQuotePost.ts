import { useMutation } from "@tanstack/react-query";
import { submitPost } from "deso-protocol";

export const MAX_QUOTE_LENGTH = 300;

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
  const normalizedPostHash = normalizePostHash(postHash);

  if (
    !normalizedPostHash ||
    !HEX_HASH_PATTERN.test(normalizedPostHash) ||
    normalizedPostHash.length % 2 !== 0
  ) {
    throw new Error("This post cannot be quoted right now.");
  }

  return normalizedPostHash;
}

export type SubmitQuotePostInput = {
  updaterPublicKey: string;
  repostedPostHash: string;
  body: string;
  imageUrls?: string[];
};

export async function submitQuotePost({
  updaterPublicKey,
  repostedPostHash,
  body,
  imageUrls = [],
}: SubmitQuotePostInput) {
  const trimmedUpdaterPublicKey = updaterPublicKey.trim();
  const trimmedBody = body.trim();
  const safeImageUrls = imageUrls
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!trimmedUpdaterPublicKey) {
    throw new Error("You need to be logged in to quote posts.");
  }

  if (!trimmedBody && safeImageUrls.length === 0) {
    throw new Error("Quote cannot be empty.");
  }

  if (trimmedBody.length > MAX_QUOTE_LENGTH) {
    throw new Error(`Quote must be ${MAX_QUOTE_LENGTH} characters or less.`);
  }

  const normalizedRepostedPostHash = assertValidPostHash(repostedPostHash);

  return submitPost({
    UpdaterPublicKeyBase58Check: trimmedUpdaterPublicKey,
    RepostedPostHashHex: normalizedRepostedPostHash,
    BodyObj: {
      Body: trimmedBody,
      ImageURLs: safeImageUrls,
      VideoURLs: [],
    },
  });
}

export function useSubmitQuotePost() {
  return useMutation({
    mutationFn: submitQuotePost,
  });
}
