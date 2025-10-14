import {
  AccessGroupEntryResponse,
  ChatType,
  DecryptedMessageEntryResponse,
  getAllAccessGroups,
  identity,
  NewMessageEntryResponse,
  type PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import {
  getAllUserMessageThreads,
  getPaginatedMessagesForDmThread,
  getPaginatedMessagesForGroupThread,
  type GetPaginatedMessagesForDmThreadRequest,
  type GetPaginatedMessagesForGroupThreadRequest,
} from "./desoApi";

// Minimal constants/types adapted from the web repo
export const DEFAULT_KEY_MESSAGING_GROUP_NAME = "default-key";

export type Conversation = {
  firstMessagePublicKey: string;
  messages: DecryptedMessageEntryResponse[];
  ChatType: ChatType;
};

export type ConversationMap = Record<string, Conversation>;

export async function getConversationsNewMap(
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> {
  const {
    decrypted,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  } = await getConversationNew(userPublicKeyBase58Check, allAccessGroups);

  const conversations: ConversationMap = {};

  decrypted.forEach((dmr) => {
    const otherInfo =
      dmr.ChatType === ChatType.DM
        ? dmr.IsSender
          ? dmr.RecipientInfo
          : dmr.SenderInfo
        : dmr.RecipientInfo;
    const key =
      otherInfo.OwnerPublicKeyBase58Check +
      (otherInfo.AccessGroupKeyName
        ? otherInfo.AccessGroupKeyName
        : DEFAULT_KEY_MESSAGING_GROUP_NAME);

    const existing = conversations[key];
    if (existing) {
      existing.messages.push(dmr);
      existing.messages.sort(
        (a, b) => b.MessageInfo.TimestampNanos - a.MessageInfo.TimestampNanos
      );
      return;
    }

    conversations[key] = {
      firstMessagePublicKey: otherInfo.OwnerPublicKeyBase58Check,
      messages: [dmr],
      ChatType: dmr.ChatType,
    } as Conversation;
  });

  return {
    conversations,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  };
}

export async function getConversationNew(
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> {
  const messages = await getAllUserMessageThreads({
    UserPublicKeyBase58Check: userPublicKeyBase58Check,
  });

  const rawThreads =
    messages.MessageThreads ?? messages.ThreadMessages ?? [];

  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      userPublicKeyBase58Check,
      rawThreads,
      allAccessGroups
    );

  return {
    decrypted,
    publicKeyToProfileEntryResponseMap:
      messages.PublicKeyToProfileEntryResponse,
    updatedAllAccessGroups,
  };
}

export async function decryptAccessGroupMessagesWithRetry(
  publicKeyBase58Check: string,
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> {
  let decryptedMessageEntries = await decryptAccessGroupMessages(
    messages,
    accessGroups
  );

  // If we see missing key errors, refetch access groups then decrypt again
  const needsAccessGroups = decryptedMessageEntries.some(
    (dmr) =>
      dmr?.error === "Error: access group key not found for group message"
  );

  if (needsAccessGroups) {
    const newAllAccessGroups = await getAllAccessGroups({
      PublicKeyBase58Check: publicKeyBase58Check,
    });
    accessGroups = (newAllAccessGroups.AccessGroupsOwned || []).concat(
      newAllAccessGroups.AccessGroupsMember || []
    );
    decryptedMessageEntries = await decryptAccessGroupMessages(
      messages,
      accessGroups
    );
  }

  return {
    decrypted: decryptedMessageEntries,
    updatedAllAccessGroups: accessGroups,
  };
}

export function decryptAccessGroupMessages(
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<DecryptedMessageEntryResponse[]> {
  return Promise.all(
    (messages || []).map((m) => identity.decryptMessage(m, accessGroups))
  );
}

export async function fetchPaginatedDmThreadMessages(
  payload: GetPaginatedMessagesForDmThreadRequest,
  accessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
}> {
  const response = await getPaginatedMessagesForDmThread(payload);
  const rawMessages = response.Messages ?? response.ThreadMessages ?? [];
  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      payload.UserGroupOwnerPublicKeyBase58Check,
      rawMessages,
      accessGroups
    );

  return {
    decrypted,
    updatedAllAccessGroups,
    publicKeyToProfileEntryResponseMap:
      response.PublicKeyToProfileEntryResponse,
  };
}

export async function fetchPaginatedGroupThreadMessages(
  payload: GetPaginatedMessagesForGroupThreadRequest,
  accessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
}> {
  const response = await getPaginatedMessagesForGroupThread(payload);
  const rawMessages = response.Messages ?? response.ThreadMessages ?? [];
  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      payload.UserPublicKeyBase58Check,
      rawMessages,
      accessGroups
    );

  return {
    decrypted,
    updatedAllAccessGroups,
    publicKeyToProfileEntryResponseMap:
      response.PublicKeyToProfileEntryResponse,
  };
}
