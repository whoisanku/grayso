import {
  AccessGroupEntryResponse,
  ChatType,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import {
  ConversationMap,
  getConversationsNewMap,
  getConversationsFromFocusGraphql,
  getSpamConversationsFromFocusGraphql,
} from "@/features/messaging/api/conversations";
import type { GroupMember } from "@/lib/deso/graphql";

export const getConversationsQueryKey = (
  userPublicKey?: string,
  mailbox: "inbox" | "spam" = "inbox"
) => ["conversations", mailbox, userPublicKey] as const;

export const fetchConversations = async (
  userPublicKey: string,
  options: { offset?: number; limit?: number; mailbox?: "inbox" | "spam" } = {}
) => {
  if (!userPublicKey) {
    throw new Error("User public key is required");
  }

  const { offset = 0, limit = 20, mailbox = "inbox" } = options;

  // Start with empty access groups - they will be fetched by GraphQL functions if needed during decryption
  let allAccessGroups: AccessGroupEntryResponse[] = [];

  let conversations: ConversationMap = {};
  let publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap = {};
  let hasMore = false;
  let groupMembers: Record<string, GroupMember[]> = {};
  let groupExtraData: Record<string, Record<string, string> | null> = {};

  try {
    const focusResult =
      mailbox === "spam"
        ? await getSpamConversationsFromFocusGraphql(
            userPublicKey,
            allAccessGroups,
            offset,
            limit
          )
        : await getConversationsFromFocusGraphql(
            userPublicKey,
            allAccessGroups,
            offset,
            limit
          );

    conversations = focusResult.conversations;
    publicKeyToProfileEntryResponseMap =
      focusResult.publicKeyToProfileEntryResponseMap;
    allAccessGroups = focusResult.updatedAllAccessGroups;
    hasMore = focusResult.hasMore;
    groupMembers = focusResult.groupMembers;
    groupExtraData = focusResult.groupExtraData;
  } catch (err) {
    console.warn("Focus GraphQL inbox fetch failed, falling back", err);
  }

  if (mailbox === "inbox" && offset === 0 && Object.keys(conversations).length === 0) {
    const fallback = await getConversationsNewMap(userPublicKey, allAccessGroups);
    conversations = fallback.conversations;
    publicKeyToProfileEntryResponseMap =
      fallback.publicKeyToProfileEntryResponseMap;
    allAccessGroups = fallback.updatedAllAccessGroups;

    // Reconcile against Focus spam threads so inbox fallback doesn't show spam too.
    try {
      const spamResult = await getSpamConversationsFromFocusGraphql(
        userPublicKey,
        allAccessGroups,
        0,
        100
      );
      const spamKeys = new Set(Object.keys(spamResult.conversations));
      if (spamKeys.size > 0) {
        conversations = Object.fromEntries(
          Object.entries(conversations).filter(([key]) => !spamKeys.has(key))
        ) as ConversationMap;
      }
      allAccessGroups = spamResult.updatedAllAccessGroups;
    } catch (spamErr) {
      console.warn(
        "[fetchConversations] Failed to filter spam from inbox fallback",
        spamErr
      );
    }
  }

  // We skip group member fetch here to keep payload light; fetch lazily per row if needed.
  const membersMap: Record<string, GroupMember[]> = {};
  const groupExtraDataMap: Record<string, Record<string, string> | null> = {};

  // Prefer results from Focus GraphQL when available; otherwise fall back to empty.
  if (Object.keys(groupMembers).length) {
    Object.assign(membersMap, groupMembers);
  }

  if (Object.keys(groupExtraData).length) {
    Object.assign(groupExtraDataMap, groupExtraData);
  }

  return {
    conversations,
    profiles: publicKeyToProfileEntryResponseMap,
    groupMembers: membersMap,
    groupExtraData: groupExtraDataMap,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
};
