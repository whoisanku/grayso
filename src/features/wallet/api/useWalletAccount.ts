import { useAccountProfile } from "@/features/profile/api/useAccountProfile";

export function useWalletAccount(params: {
  publicKey?: string;
  username?: string;
}) {
  return useAccountProfile(params);
}
