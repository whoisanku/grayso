import { useMutation } from "@tanstack/react-query";
import { submitPost } from "deso-protocol";

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
    throw new Error("This post cannot be reposted right now.");
  }

  return normalizedPostHash;
}

export type SubmitRepostInput = {
  updaterPublicKey: string;
  repostedPostHash: string;
};

export async function submitRepost({
  updaterPublicKey,
  repostedPostHash,
}: SubmitRepostInput) {
  const trimmedUpdaterPublicKey = updaterPublicKey.trim();

  if (!trimmedUpdaterPublicKey) {
    throw new Error("You need to be logged in to repost.");
  }

  const normalizedRepostedPostHash = assertValidPostHash(repostedPostHash);

  return submitPost({
    UpdaterPublicKeyBase58Check: trimmedUpdaterPublicKey,
    RepostedPostHashHex: normalizedRepostedPostHash,
    BodyObj: {
      Body: "",
      ImageURLs: [],
      VideoURLs: [],
    },
  });
}

export function useSubmitRepost() {
  return useMutation({
    mutationFn: submitRepost,
  });
}
