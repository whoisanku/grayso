import {
  ChatType,
  getAllAccessGroups,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import {
  ConversationMap,
  getConversationsNewMap,
  getConversationsFromFocusGraphql,
  getSpamConversationsFromFocusGraphql,
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

  let allAccessGroups = (AccessGroupsOwned || []).concat(
    AccessGroupsMember || []
  );

  let conversations: ConversationMap = {};
  let spamConversations: ConversationMap = {};
  let publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap = {};
  let spamPublicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap =
    {};

  try {
    const focusResult = await getConversationsFromFocusGraphql(
      userPublicKey,
      allAccessGroups
    );

    conversations = focusResult.conversations;
    publicKeyToProfileEntryResponseMap =
      focusResult.publicKeyToProfileEntryResponseMap;
    allAccessGroups = focusResult.updatedAllAccessGroups;

    try {
      const spamResult = await getSpamConversationsFromFocusGraphql(
        userPublicKey,
        allAccessGroups
      );
      spamConversations = spamResult.conversations;
      spamPublicKeyToProfileEntryResponseMap =
        spamResult.publicKeyToProfileEntryResponseMap;
      allAccessGroups = spamResult.updatedAllAccessGroups;
    } catch (err) {
      console.warn("Focus GraphQL spam inbox fetch failed", err);
    }
  } catch (err) {
    console.warn("Focus GraphQL inbox fetch failed, falling back", err);
  }

  if (Object.keys(conversations).length === 0) {
    const fallback = await getConversationsNewMap(userPublicKey, allAccessGroups);
    conversations = fallback.conversations;
    publicKeyToProfileEntryResponseMap =
      fallback.publicKeyToProfileEntryResponseMap;
    allAccessGroups = fallback.updatedAllAccessGroups;
  }

  // Fetch group members for avatars (include both inbox and spam group chats)
  const inboxGroupChats = Object.values(conversations).filter(
    (c) => c.ChatType === ChatType.GROUPCHAT
  );
  const spamGroupChats = Object.values(spamConversations).filter(
    (c) => c.ChatType === ChatType.GROUPCHAT
  );
  const groupChats = [...inboxGroupChats, ...spamGroupChats];

  const membersMap: Record<string, GroupMember[]> = {};
  const groupExtraDataMap: Record<string, Record<string, string> | null> = {};

  await Promise.all(
    groupChats.map(async (chat) => {
      const lastMsg = chat.messages[0];
      if (!lastMsg) return;

      const accessGroupKeyName = lastMsg.RecipientInfo.AccessGroupKeyName;
      const ownerPublicKey = lastMsg.RecipientInfo.OwnerPublicKeyBase58Check;

      if (!accessGroupKeyName || !ownerPublicKey) return;

      try {
        const { members, extraData } = await fetchAccessGroupMembers({
          accessGroupKeyName,
          accessGroupOwnerPublicKey: ownerPublicKey,
          limit: 4, // Fetch just enough for the stack
        });

        // Create a unique key for the group
        const groupKey = `${ownerPublicKey}-${accessGroupKeyName}`;
        membersMap[groupKey] = members;
        groupExtraDataMap[groupKey] = extraData || null;
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
    spamConversations,
    profiles: {
      ...publicKeyToProfileEntryResponseMap,
      ...spamPublicKeyToProfileEntryResponseMap,
    },
    groupMembers: membersMap,
    groupExtraData: groupExtraDataMap,
  };
};
