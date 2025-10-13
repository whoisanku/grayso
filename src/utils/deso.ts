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
