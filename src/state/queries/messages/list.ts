import {
  ChatType,
  getAllAccessGroups,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import {
  ConversationMap,
  getConversationsNewMap,
} from "../../../services/conversations";
import { fetchAccessGroupMembers, GroupMember } from "../../../services/desoGraphql";

export const getConversationsQueryKey = (userPublicKey?: string) =>
  ["conversations", userPublicKey] as const;

export const fetchConversations = async (userPublicKey: string) => {
  if (!userPublicKey) {
    throw new Error("User public key is required");
  }

  const { AccessGroupsOwned, AccessGroupsMember } = await getAllAccessGroups({
    PublicKeyBase58Check: userPublicKey,
  });

  const allAccessGroups = (AccessGroupsOwned || []).concat(
    AccessGroupsMember || []
  );

  const { conversations, publicKeyToProfileEntryResponseMap } =
    await getConversationsNewMap(userPublicKey, allAccessGroups);

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
        console.warn(
          `Failed to fetch members for group ${accessGroupKeyName}`,
          err
        );
      }
    })
  );

  return {
    conversations,
    profiles: publicKeyToProfileEntryResponseMap,
    groupMembers: membersMap,
  };
};
