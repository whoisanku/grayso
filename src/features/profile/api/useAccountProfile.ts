import { useQuery } from "@tanstack/react-query";
import { fetchAccountExtendedByPublicKey, fetchAccountExtendedByUsername, type FocusAccount } from "@/lib/focus/graphql";
import { profileKeys } from "./keys";

export function useAccountProfile(params: { publicKey?: string; username?: string }) {
  const { publicKey, username } = params;

  return useQuery<FocusAccount | null>({
    queryKey: publicKey ? profileKeys.account(publicKey) : username ? ["profile", "username", username] : profileKeys.base,
    queryFn: () => {
      if (publicKey) {
        return fetchAccountExtendedByPublicKey({ publicKey });
      }
      if (username) {
        return fetchAccountExtendedByUsername({ username });
      }
      throw new Error("Public key or username is required to fetch profile");
    },
    enabled: Boolean(publicKey || username),
    staleTime: 1000 * 60 * 5,
  });
}
