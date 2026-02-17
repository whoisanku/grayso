import { useMutation } from "@tanstack/react-query";
import {
  createPostAssociation,
  deletePostAssociation,
  getPostAssociations,
} from "deso-protocol";

import { type FocusFeedPost } from "@/lib/focus/graphql";

const HEX_HASH_PATTERN = /^[0-9a-fA-F]+$/;

export const FOCUS_REACTION_ASSOCIATION_TYPE = "REACTION";

export const FOCUS_POST_REACTION_OPTIONS = [
  { value: "LIKE", label: "Like", emoji: "👍", color: "#2563eb" },
  { value: "DISLIKE", label: "Dislike", emoji: "👎", color: "#64748b" },
  { value: "LOVE", label: "Love", emoji: "❤️", color: "#ef4444" },
  { value: "LAUGH", label: "Haha", emoji: "🤣", color: "#f59e0b" },
  { value: "SAD", label: "Sad", emoji: "😔", color: "#f59e0b" },
  { value: "CRY", label: "Cry", emoji: "😭", color: "#3b82f6" },
  { value: "ANGRY", label: "Angry", emoji: "🤬", color: "#f97316" },
] as const;

export type FocusPostReactionValue =
  (typeof FOCUS_POST_REACTION_OPTIONS)[number]["value"];

const FOCUS_POST_REACTION_VALUE_SET = new Set<FocusPostReactionValue>(
  FOCUS_POST_REACTION_OPTIONS.map((option) => option.value),
);

export type PostReactionAssociation = {
  associationId: string;
  associationValue: FocusPostReactionValue;
};

async function deleteReactionAssociations({
  readerPublicKey,
  associations,
}: {
  readerPublicKey: string;
  associations: PostReactionAssociation[];
}) {
  for (const association of associations) {
    await deletePostAssociation({
      TransactorPublicKeyBase58Check: readerPublicKey,
      AssociationID: association.associationId,
    });
  }
}

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
    throw new Error("This post cannot be reacted to right now.");
  }

  return normalized;
}

function isFocusPostReactionValue(
  value: unknown,
): value is FocusPostReactionValue {
  return (
    typeof value === "string" &&
    FOCUS_POST_REACTION_VALUE_SET.has(value as FocusPostReactionValue)
  );
}

export function getReactionOption(
  reactionValue: FocusPostReactionValue | null | undefined,
) {
  if (!reactionValue) {
    return null;
  }

  return (
    FOCUS_POST_REACTION_OPTIONS.find(
      (option) => option.value === reactionValue,
    ) ?? null
  );
}

export function normalizeReactionAssociations(
  associations: {
    associationId?: string | null;
    associationValue?: string | null;
  }[],
): PostReactionAssociation[] {
  const deduped = new Map<string, PostReactionAssociation>();

  for (const association of associations) {
    const associationId = association.associationId?.trim();
    const associationValue = association.associationValue?.trim();

    if (!associationId || !associationValue) {
      continue;
    }

    if (!isFocusPostReactionValue(associationValue)) {
      continue;
    }

    deduped.set(associationId, {
      associationId,
      associationValue,
    });
  }

  return Array.from(deduped.values());
}

export function extractViewerReactionAssociations(
  post: Pick<FocusFeedPost, "viewerReactions">,
): PostReactionAssociation[] {
  const nodes = post.viewerReactions?.nodes ?? [];

  return normalizeReactionAssociations(
    nodes.map((node) => ({
      associationId: node.associationId,
      associationValue: node.associationValue,
    })),
  );
}

export async function fetchReaderReactionAssociations({
  readerPublicKey,
  postHash,
}: {
  readerPublicKey: string;
  postHash: string;
}): Promise<PostReactionAssociation[]> {
  if (!readerPublicKey.trim()) {
    return [];
  }

  const normalizedPostHash = assertValidPostHash(postHash);
  const response = await getPostAssociations({
    PostHashHex: normalizedPostHash,
    TransactorPublicKeyBase58Check: readerPublicKey,
    AssociationType: FOCUS_REACTION_ASSOCIATION_TYPE,
    Limit: 20,
    SortDescending: true,
  });

  const associations = response?.Associations ?? [];
  return normalizeReactionAssociations(
    associations.map((association) => ({
      associationId: association.AssociationID,
      associationValue: association.AssociationValue,
    })),
  );
}

export async function setPostReactionAssociation({
  readerPublicKey,
  postHash,
  reactionValue,
  existingAssociations,
}: {
  readerPublicKey: string;
  postHash: string;
  reactionValue: FocusPostReactionValue | null;
  existingAssociations?: PostReactionAssociation[];
}): Promise<{
  currentReaction: FocusPostReactionValue | null;
  associations: PostReactionAssociation[];
}> {
  const trimmedReaderKey = readerPublicKey.trim();
  if (!trimmedReaderKey) {
    throw new Error("Login required.");
  }

  const normalizedPostHash = assertValidPostHash(postHash);
  const normalizedExisting = normalizeReactionAssociations(
    existingAssociations ?? [],
  );
  const hasKnownAssociations = existingAssociations !== undefined;
  let currentAssociations = hasKnownAssociations
    ? normalizedExisting
    : await fetchReaderReactionAssociations({
        readerPublicKey: trimmedReaderKey,
        postHash: normalizedPostHash,
      });

  const deleteKnownAssociations = async () => {
    if (currentAssociations.length === 0) {
      return;
    }

    try {
      await deleteReactionAssociations({
        readerPublicKey: trimmedReaderKey,
        associations: currentAssociations,
      });
      currentAssociations = [];
      return;
    } catch (error) {
      if (!hasKnownAssociations) {
        throw error;
      }
    }

    const refreshedAssociations = await fetchReaderReactionAssociations({
      readerPublicKey: trimmedReaderKey,
      postHash: normalizedPostHash,
    });

    if (refreshedAssociations.length === 0) {
      currentAssociations = [];
      return;
    }

    await deleteReactionAssociations({
      readerPublicKey: trimmedReaderKey,
      associations: refreshedAssociations,
    });
    currentAssociations = [];
  };

  const currentReaction = currentAssociations[0]?.associationValue ?? null;

  // Clicking the same active reaction clears it (Facebook-like toggle behavior).
  if (reactionValue && reactionValue === currentReaction) {
    await deleteKnownAssociations();

    return {
      currentReaction: null,
      associations: [],
    };
  }

  await deleteKnownAssociations();

  if (reactionValue) {
    try {
      await createPostAssociation({
        AssociationType: FOCUS_REACTION_ASSOCIATION_TYPE,
        AssociationValue: reactionValue,
        PostHashHex: normalizedPostHash,
        TransactorPublicKeyBase58Check: trimmedReaderKey,
        MinFeeRateNanosPerKB: 1000,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "";
      if (!/already\s+exists|duplicate/i.test(message)) {
        throw error;
      }
    }
  }

  const nextAssociations = await fetchReaderReactionAssociations({
    readerPublicKey: trimmedReaderKey,
    postHash: normalizedPostHash,
  });

  return {
    currentReaction: nextAssociations[0]?.associationValue ?? null,
    associations: nextAssociations,
  };
}

export function useSetPostReactionAssociation() {
  return useMutation({
    mutationFn: setPostReactionAssociation,
  });
}
