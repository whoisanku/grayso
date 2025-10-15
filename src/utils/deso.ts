import {
  buildProfilePictureUrl,
  type TransactionSpendingLimitResponseOptions,
} from "deso-protocol";
import type { ProfileEntryResponse } from "deso-protocol";

export const FALLBACK_PROFILE_IMAGE =
  "https://images.deso.org/placeholder-profile-pic.png";

export const FALLBACK_GROUP_IMAGE =
  "https://images.deso.org/placeholder-profile-pic.png";

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

  // Use deso-protocol helper for consistent CDN URL with fallback
  return buildProfilePictureUrl(publicKey, {
    fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
  });
}

export function getTransactionSpendingLimits(
  publicKey: string
): TransactionSpendingLimitResponseOptions {
  const UNLIMITED = "UNLIMITED" as unknown as number; // the SDK accepts this string sentinel
  return {
    GlobalDESOLimit: 5 * 1e9,
    TransactionCountLimitMap: {
      AUTHORIZE_DERIVED_KEY: 1,
      NEW_MESSAGE: UNLIMITED as any,
    } as any,
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
