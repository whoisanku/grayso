import { type TransactionSpendingLimitResponseOptions } from "deso-protocol";
import type { ProfileEntryResponse } from "deso-protocol";

export const FALLBACK_PROFILE_IMAGE =
  "https://node.deso.org/assets/img/default_profile_pic.png";

export const FALLBACK_GROUP_IMAGE =
  "https://node.deso.org/assets/img/default_profile_pic.png";

export const formatPublicKey = (value: string) => {
  if (!value) {
    return "";
  }

  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
};

export const getProfileDisplayName = (
  profile: ProfileEntryResponse | null | undefined,
  publicKey: string
) => {
  const username = profile?.Username?.trim();
  if (username) {
    return username;
  }

  return formatPublicKey(publicKey);
};

// Deterministically generate a hex color from a string
function generateHexColorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const r = (hash >> 16) & 0xff;
  const g = (hash >> 8) & 0xff;
  const b = hash & 0xff;
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `${toHex(Math.abs(r))}${toHex(Math.abs(g))}${toHex(Math.abs(b))}`;
}

export function getProfileImageUrl(
  publicKey?: string,
  opts?: { groupChat?: boolean }
): string {
  if (!publicKey) {
    return FALLBACK_PROFILE_IMAGE;
  }

  if (opts?.groupChat) {
    const sanitized = publicKey.replace(/[^a-zA-Z0-9]+/g, "");
    const bg = generateHexColorFromString(publicKey.slice(0, 2));
    return `https://ui-avatars.com/api/?name=${sanitized}&background=${bg}`;
  }

  const encodedFallback = encodeURIComponent(FALLBACK_PROFILE_IMAGE);
  return `https://node.deso.org/api/v0/get-single-profile-picture/${publicKey}?fallback=${encodedFallback}`;
}

export function getTransactionSpendingLimits(
  publicKey: string
): TransactionSpendingLimitResponseOptions {
  const UNLIMITED = "UNLIMITED" as unknown as number; // the SDK accepts this string sentinel
  return {
    GlobalDESOLimit: 1 * 1e9,
    TransactionCountLimitMap: {
      AUTHORIZE_DERIVED_KEY: 1,
      FOLLOW: UNLIMITED as any,
      UNFOLLOW: UNLIMITED as any,
      NEW_MESSAGE: UNLIMITED as any,
      SUBMIT_POST: UNLIMITED as any,
      LIKE: UNLIMITED as any,
      CREATE_POST_ASSOCIATION: UNLIMITED as any,
      DELETE_POST_ASSOCIATION: UNLIMITED as any,
      ACCESS_GROUP: UNLIMITED as any,
      ACCESS_GROUP_MEMBERS: UNLIMITED as any,
      DELETE_USER_ASSOCIATION: UNLIMITED as any,
    } as any,
    AssociationLimitMap: [
      // Specific permission for spam/inbox operations
      {
        AssociationClass: "User" as any,
        AssociationType: "CUSTOM_MESSAGING_THREAD_SETTINGS",
        AppScopeType: "Any" as any,
        AppPublicKeyBase58Check: "",
        AssociationOperation: "Create" as any,
        OpCount: UNLIMITED as any,
      },
      {
        AssociationClass: "User" as any,
        AssociationType: "CUSTOM_MESSAGING_THREAD_SETTINGS",
        AppScopeType: "Any" as any,
        AppPublicKeyBase58Check: "",
        AssociationOperation: "Delete" as any,
        OpCount: UNLIMITED as any,
      },
      // Broad permissions for Post associations
      {
        AssociationClass: "Post" as any,
        AssociationType: "",
        AppScopeType: "Any" as any,
        AppPublicKeyBase58Check: "",
        AssociationOperation: "Any" as any,
        OpCount: UNLIMITED as any,
      },
      // Broad permissions for User associations
      {
        AssociationClass: "User" as any,
        AssociationType: "",
        AppScopeType: "Any" as any,
        AppPublicKeyBase58Check: "",
        AssociationOperation: "Any" as any,
        OpCount: UNLIMITED as any,
      },
    ],
    AccessGroupLimitMap: [
      {
        AccessGroupOwnerPublicKeyBase58Check: publicKey,
        ScopeType: "Any" as any,
        AccessGroupKeyName: "",
        OperationType: "Any" as any,
        OpCount: UNLIMITED as any,
      },
    ],
    AccessGroupMemberLimitMap: [
      {
        AccessGroupOwnerPublicKeyBase58Check: publicKey,
        ScopeType: "Any" as any,
        AccessGroupKeyName: "",
        OperationType: "Any" as any,
        OpCount: UNLIMITED as any,
      },
    ],
  } as any;
}
