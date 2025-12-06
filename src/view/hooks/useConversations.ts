import { useContext, useCallback } from "react";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useQuery } from "@tanstack/react-query";
import { fetchConversations, getConversationsQueryKey } from "../../state/queries/messages/list";
import { identity } from "deso-protocol";

export const useConversations = () => {
  const { currentUser } = useContext(DeSoIdentityContext);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: getConversationsQueryKey(currentUser?.PublicKeyBase58Check),
    queryFn: async () => {
        try {
             return await fetchConversations(currentUser!.PublicKeyBase58Check);
        } catch (e: any) {
             const message: string = e?.message ?? "";
            if (message.includes("Cannot decrypt messages")) {
                console.warn("Unable to decrypt conversations for current user", {
                    publicKey: currentUser?.PublicKeyBase58Check,
                    error: e,
                });
                try {
                    await identity.logout();
                } catch (logoutError) {
                    console.warn("Failed to logout after decryption error", logoutError);
                }
            }
            throw e;
        }
    },
    enabled: !!currentUser?.PublicKeyBase58Check,
    staleTime: 1000 * 30, // 30 seconds
  });

  return {
    conversations: data?.conversations ?? {},
    profiles: data?.profiles ?? {},
    groupMembers: data?.groupMembers ?? {},
    isLoading,
    error: isError ? (error as Error).message : null,
    reload: refetch,
  };
};
