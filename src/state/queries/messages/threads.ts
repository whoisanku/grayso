import type {
  AccessGroupEntryResponse,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import { getAllMessageThreads, getAllAccessGroups } from "deso-protocol";

import type {
  ConversationMap,
  ThreadMetaMap,
} from "@/features/messaging/api/conversations";
import { 
  getAllConversationsFromFocusGraphql,
  decryptAccessGroupMessagesWithRetry,
} from "@/features/messaging/api/conversations";
import type { GroupMember } from "@/lib/deso/graphql";

export const conversationThreadsKeys = {
  all: (userPublicKey?: string) => ["conversationThreads", userPublicKey] as const,
};

const buildConversationMapFromMessages = (
  decrypted: any[]
): ConversationMap => {
  const conversations: ConversationMap = {};

  decrypted.forEach((dmr) => {
    const otherInfo =
      dmr.ChatType === "DM"
        ? dmr.IsSender
          ? dmr.RecipientInfo
          : dmr.SenderInfo
        : dmr.RecipientInfo;

    const key =
      otherInfo.OwnerPublicKeyBase58Check +
      (otherInfo.AccessGroupKeyName || "default-key");
    const currentConversation = conversations[key];

    if (currentConversation) {
      currentConversation.messages.push(dmr);
      currentConversation.messages.sort(
        (a: any, b: any) =>
          (b.MessageInfo?.TimestampNanos ?? 0) -
          (a.MessageInfo?.TimestampNanos ?? 0)
      );
      return;
    }

    conversations[key] = {
      firstMessagePublicKey: otherInfo.OwnerPublicKeyBase58Check,
      messages: [dmr],
      ChatType: dmr.ChatType,
    };
  });

  return conversations;
};

/**
 * Fetches conversation threads with automatic GraphQL-to-REST fallback.
 * Tries Focus GraphQL first, falls back to DeSo REST API on timeout/error.
 * Never throws - returns empty data structure on complete failure to prevent error UI.
 */
export const fetchConversationThreads = async (
  userPublicKey: string,
  options: { offset?: number; limit?: number } = {}
): Promise<{
  conversations: ConversationMap;
  profiles: PublicKeyToProfileEntryResponseMap;
  groupMembers: Record<string, GroupMember[]>;
  groupExtraData: Record<string, Record<string, string> | null>;
  threadMeta: ThreadMetaMap;
  hasMore: boolean;
  nextOffset: number | null;
  accessGroups: AccessGroupEntryResponse[];
}> => {
  if (!userPublicKey) {
    console.warn("[fetchConversationThreads] No user public key provided");
    return {
      conversations: {},
      profiles: {},
      groupMembers: {},
      groupExtraData: {},
      threadMeta: {},
      hasMore: false,
      nextOffset: null,
      accessGroups: [],
    };
  }

  const { offset = 0, limit = 20 } = options;
  let allAccessGroups: AccessGroupEntryResponse[] = [];

  try {
    // Try GraphQL first
    console.log("[fetchConversationThreads] Attempting GraphQL fetch...");
    const result = await getAllConversationsFromFocusGraphql(
      userPublicKey,
      allAccessGroups,
      offset,
      limit
    );

    allAccessGroups = result.updatedAllAccessGroups;

    return {
      conversations: result.conversations,
      profiles: result.publicKeyToProfileEntryResponseMap,
      groupMembers: result.groupMembers,
      groupExtraData: result.groupExtraData,
      threadMeta: result.threadMeta,
      hasMore: result.hasMore,
      nextOffset: result.hasMore ? offset + limit : null,
      accessGroups: allAccessGroups,
    };
  } catch (graphqlError: any) {
    const errorMessage = graphqlError?.message || String(graphqlError);
    console.warn(
      "[fetchConversationThreads] GraphQL failed, falling back to REST API:",
      errorMessage
    );

    try {
      // Fall back to REST API
      console.log("[fetchConversationThreads] Attempting REST API fetch...");
      
      // Fetch all access groups first if not already loaded
      if (allAccessGroups.length === 0) {
        const accessGroupsResponse = await getAllAccessGroups({
          PublicKeyBase58Check: userPublicKey,
        });
        allAccessGroups = [
          ...(accessGroupsResponse.AccessGroupsOwned || []),
          ...(accessGroupsResponse.AccessGroupsMember || []),
        ];
      }

      // Fetch message threads via REST
      const messages = await getAllMessageThreads({
        UserPublicKeyBase58Check: userPublicKey,
      });

      const rawThreads = messages.MessageThreads ?? (messages as any).ThreadMessages ?? [];

      // Decrypt messages
      const { decrypted, updatedAllAccessGroups } =
        await decryptAccessGroupMessagesWithRetry(
          userPublicKey,
          rawThreads,
          allAccessGroups
        );

      const conversations = buildConversationMapFromMessages(decrypted);

      console.log(
        `[fetchConversationThreads] REST API fallback successful: ${Object.keys(conversations).length} conversations loaded`
      );

      return {
        conversations,
        profiles: messages.PublicKeyToProfileEntryResponse || {},
        groupMembers: {},
        groupExtraData: {},
        threadMeta: {},
        hasMore: false, // REST API doesn't support pagination in the same way
        nextOffset: null,
        accessGroups: updatedAllAccessGroups,
      };
    } catch (restError: any) {
      const restErrorMessage = restError?.message || String(restError);
      console.error(
        "[fetchConversationThreads] Both GraphQL and REST API failed:",
        { graphqlError: errorMessage, restError: restErrorMessage }
      );

      // Return empty structure instead of throwing to prevent error UI
      return {
        conversations: {},
        profiles: {},
        groupMembers: {},
        groupExtraData: {},
        threadMeta: {},
        hasMore: false,
        nextOffset: null,
        accessGroups: allAccessGroups,
      };
    }
  }
};

