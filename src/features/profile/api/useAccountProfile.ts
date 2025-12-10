import { useQuery } from "@tanstack/react-query";
import { fetchAccountExtendedByPublicKey, type FocusAccount } from "@/lib/focus/graphql";
import { profileKeys } from "./keys";

export function useAccountProfile(publicKey?: string) {
  return useQuery<FocusAccount | null>({
    queryKey: publicKey ? profileKeys.account(publicKey) : profileKeys.base,
    queryFn: () => {
      if (!publicKey) {
        throw new Error("Public key is required to fetch profile");
      }
      return fetchAccountExtendedByPublicKey({ publicKey });
    },
    enabled: Boolean(publicKey),
    staleTime: 1000 * 60 * 5,
  });
}
