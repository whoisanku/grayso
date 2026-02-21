const REACTION_ICON_BY_TYPE = {
  LIKE: "like",
  DISLIKE: "dislike",
  LOVE: "heart",
  LAUGH: "laugh",
  ASTONISHED: "wow",
  SAD: "sad",
  CRY: "sad",
  ANGRY: "angry",
} as const;

const REACTION_LABEL_BY_TYPE = {
  LIKE: "Like",
  DISLIKE: "Dislike",
  LOVE: "Love",
  LAUGH: "Haha",
  ASTONISHED: "Wow",
  SAD: "Sad",
  CRY: "Cry",
  ANGRY: "Angry",
} as const;

export type ReactionTypeToken = keyof typeof REACTION_ICON_BY_TYPE;
export type ReactionIconName = (typeof REACTION_ICON_BY_TYPE)[ReactionTypeToken];

function hasKnownReactionType(value: string): value is ReactionTypeToken {
  return Object.prototype.hasOwnProperty.call(REACTION_ICON_BY_TYPE, value);
}

export function toReactionTypeToken(
  rawValue: string | null | undefined,
): ReactionTypeToken | null {
  const normalized = rawValue?.trim().toUpperCase();
  if (!normalized || !hasKnownReactionType(normalized)) {
    return null;
  }

  return normalized;
}

export function getReactionTypeFromSubcategory(
  rawSubcategory: string | null | undefined,
): ReactionTypeToken | null {
  const normalized = rawSubcategory?.trim().toUpperCase();
  if (!normalized || !normalized.startsWith("REACTION_")) {
    return null;
  }

  const reactionType = normalized.slice("REACTION_".length);
  return toReactionTypeToken(reactionType);
}

export function getReactionIconName(
  rawReactionType: string | null | undefined,
): ReactionIconName | null {
  const reactionType = toReactionTypeToken(rawReactionType);
  if (!reactionType) {
    return null;
  }

  return REACTION_ICON_BY_TYPE[reactionType];
}

export function getReactionIconNameFromSubcategory(
  rawSubcategory: string | null | undefined,
): ReactionIconName | null {
  const reactionType = getReactionTypeFromSubcategory(rawSubcategory);
  if (!reactionType) {
    return null;
  }

  return REACTION_ICON_BY_TYPE[reactionType];
}

export function getReactionLabel(
  rawReactionType: string | null | undefined,
): string | null {
  const reactionType = toReactionTypeToken(rawReactionType);
  if (!reactionType) {
    return null;
  }

  return REACTION_LABEL_BY_TYPE[reactionType];
}

export function getReactionLabelFromSubcategory(
  rawSubcategory: string | null | undefined,
): string | null {
  const reactionType = getReactionTypeFromSubcategory(rawSubcategory);
  if (!reactionType) {
    return null;
  }

  return REACTION_LABEL_BY_TYPE[reactionType];
}
