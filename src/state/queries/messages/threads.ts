import type {
  AccessGroupEntryResponse,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";

import type {
  ConversationMap,
  ThreadMetaMap,
} from "@/features/messaging/api/conversations";
import { getAllConversationsFromFocusGraphql } from "@/features/messaging/api/conversations";
import type { GroupMember } from "@/lib/deso/graphql";

export const conversationThreadsKeys = {
  all: (userPublicKey?: string) => ["conversationThreads", userPublicKey] as const,
};

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
    throw new Error("User public key is required");
  }

  const { offset = 0, limit = 20 } = options;

  let allAccessGroups: AccessGroupEntryResponse[] = [];

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
};

