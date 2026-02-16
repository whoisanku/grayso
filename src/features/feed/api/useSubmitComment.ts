import { useMutation } from "@tanstack/react-query";
import { submitPost } from "deso-protocol";

export const MAX_COMMENT_LENGTH = 300;

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

export type SubmitCommentInput = {
  updaterPublicKey: string;
  parentPostHash: string;
  body: string;
  imageUrls?: string[];
};

export async function submitComment({
  updaterPublicKey,
  parentPostHash,
  body,
  imageUrls = [],
}: SubmitCommentInput) {
  const normalizedPostHash = normalizePostHash(parentPostHash);
  const trimmedBody = body.trim();
  const safeImageUrls = imageUrls
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!updaterPublicKey.trim()) {
    throw new Error("You need to be logged in to comment.");
  }

  if (!trimmedBody && safeImageUrls.length === 0) {
    throw new Error("Reply cannot be empty.");
  }

  if (trimmedBody.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment must be ${MAX_COMMENT_LENGTH} characters or less.`);
  }

  if (
    !normalizedPostHash ||
    !HEX_HASH_PATTERN.test(normalizedPostHash) ||
    normalizedPostHash.length % 2 !== 0
  ) {
    throw new Error("This post cannot be replied to right now.");
  }

  return submitPost({
    UpdaterPublicKeyBase58Check: updaterPublicKey,
    ParentStakeID: normalizedPostHash,
    BodyObj: {
      Body: trimmedBody,
      ImageURLs: safeImageUrls,
      VideoURLs: [],
    },
  });
}

export function useSubmitComment() {
  return useMutation({
    mutationFn: submitComment,
  });
}
