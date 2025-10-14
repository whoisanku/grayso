import { useState, useCallback, useContext, useEffect } from "react";
import {
  ChatType,
  DecryptedMessageEntryResponse,
  AccessGroupEntryResponse,
  PublicKeyToProfileEntryResponseMap,
  getAllAccessGroups,
  identity,
} from "deso-protocol";
import {
  getConversationsNewMap,
  ConversationMap,
} from "../services/conversations";
import { DeSoIdentityContext } from "react-deso-protocol";

export const useConversations = () => {
  const { currentUser } = useContext(DeSoIdentityContext);
  const [conversations, setConversations] = useState<ConversationMap>({});
  const [
    profiles,
    setProfiles,
  ] = useState<PublicKeyToProfileEntryResponseMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!currentUser?.PublicKeyBase58Check) {
      setConversations({});
      setProfiles({});
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { AccessGroupsOwned, AccessGroupsMember } = await getAllAccessGroups({
        PublicKeyBase58Check: currentUser.PublicKeyBase58Check,
      });
      const allAccessGroups = (
        AccessGroupsOwned || []
      ).concat(AccessGroupsMember || []);

      const { conversations, publicKeyToProfileEntryResponseMap } =
        await getConversationsNewMap(currentUser.PublicKeyBase58Check, allAccessGroups);

      setConversations(conversations);
      setProfiles(publicKeyToProfileEntryResponseMap);
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
      setError("Failed to load conversations");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.PublicKeyBase58Check]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return { conversations, profiles, isLoading, error, reload: loadConversations };
};

