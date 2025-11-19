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
import { fetchAccessGroupMembers, GroupMember } from "../services/desoGraphql";
import { DeSoIdentityContext } from "react-deso-protocol";

export const useConversations = () => {
  const { currentUser } = useContext(DeSoIdentityContext);
  const [conversations, setConversations] = useState<ConversationMap>({});
  const [
    profiles,
    setProfiles,
  ] = useState<PublicKeyToProfileEntryResponseMap>({});
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});
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

      // Fetch group members for avatars
      const groupChats = Object.values(conversations).filter(
        (c) => c.ChatType === ChatType.GROUPCHAT
      );

      const membersMap: Record<string, GroupMember[]> = {};
      
      await Promise.all(
        groupChats.map(async (chat) => {
          const lastMsg = chat.messages[0];
          if (!lastMsg) return;
          
          const accessGroupKeyName = lastMsg.RecipientInfo.AccessGroupKeyName;
          const ownerPublicKey = lastMsg.RecipientInfo.OwnerPublicKeyBase58Check;
          
          if (!accessGroupKeyName || !ownerPublicKey) return;

          try {
            const { members } = await fetchAccessGroupMembers({
              accessGroupKeyName,
              accessGroupOwnerPublicKey: ownerPublicKey,
              limit: 4, // Fetch just enough for the stack
            });
            
            // Create a unique key for the group
            const groupKey = `${ownerPublicKey}-${accessGroupKeyName}`;
            membersMap[groupKey] = members;
          } catch (err) {
            console.warn(`Failed to fetch members for group ${accessGroupKeyName}`, err);
          }
        })
      );

      setGroupMembers(membersMap);
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

  return { conversations, profiles, groupMembers, isLoading, error, reload: loadConversations };
};

