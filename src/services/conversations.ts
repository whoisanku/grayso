import {
  AccessGroupEntryResponse,
  ChatType,
  checkPartyAccessGroups,
  DecryptedMessageEntryResponse,
  getAllAccessGroups,
  getAllMessageThreads,
  identity,
  NewMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
  sendDMMessage,
  sendGroupChatMessage,
  waitForTransactionFound,
} from "deso-protocol";
import { bytesToHex } from "@noble/hashes/utils";
import {
  getPaginatedMessagesForDmThread,
  getPaginatedMessagesForGroupThread,
  GetPaginatedMessagesForDmThreadRequest,
  GetPaginatedMessagesForGroupThreadRequest,
} from "./desoApi";
import {
  buildDefaultProfileEntry,
  fetchDmMessagesViaGraphql,
  normalizeTimestampToNanos,
} from "./desoGraphql";

// This was causing issues, so defining it locally.
// You might want to create the files and export from there.
export const DEFAULT_KEY_MESSAGING_GROUP_NAME = "default-key";
const USER_TO_SEND_MESSAGE_TO = ""; // Add a public key here

export type Conversation = {
  firstMessagePublicKey: string;
  messages: DecryptedMessageEntryResponse[];
  ChatType: ChatType;
};

export type ConversationMap = Record<string, Conversation>;

export const getConversationsNewMap = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
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
    const currentConversation = conversations[key];
    if (currentConversation) {
      currentConversation.messages.push(dmr);
      currentConversation.messages.sort(
        (a: DecryptedMessageEntryResponse, b: DecryptedMessageEntryResponse) => (b.MessageInfo?.TimestampNanos ?? 0) - (a.MessageInfo?.TimestampNanos ?? 0)
      );
      return;
    }
    conversations[key] = {
      firstMessagePublicKey: otherInfo.OwnerPublicKeyBase58Check,
      messages: [dmr],
      ChatType: dmr.ChatType,
    };
  });
  return {
    conversations,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  };
};

export const getConversationNew = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  const messages = await getAllMessageThreads({
    UserPublicKeyBase58Check: userPublicKeyBase58Check,
  });
  const rawThreads = messages.MessageThreads ?? (messages as any).ThreadMessages ?? [];
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
};

export const getConversations = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[]
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  try {
    let {
      conversations,
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups,
    } = await getConversationsNewMap(userPublicKeyBase58Check, allAccessGroups);

    if (Object.keys(conversations).length === 0) {
      const txnHashHex = await encryptAndSendNewMessage(
        "Hi. This is my first test message!",
        userPublicKeyBase58Check,
        USER_TO_SEND_MESSAGE_TO
      );
      await waitForTransactionFound(txnHashHex);
      const getConversationsNewMapResponse = await getConversationsNewMap(
        userPublicKeyBase58Check,
        allAccessGroups
      );
      conversations = getConversationsNewMapResponse.conversations;
      publicKeyToProfileEntryResponseMap =
        getConversationsNewMapResponse.publicKeyToProfileEntryResponseMap;
      updatedAllAccessGroups =
        getConversationsNewMapResponse.updatedAllAccessGroups;
    }
    return {
      conversations,
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups,
    };
  } catch (e: any) {
    console.error(e);
    return {
      conversations: {},
      publicKeyToProfileEntryResponseMap: {},
      updatedAllAccessGroups: [],
    };
  }
};

export const decryptAccessGroupMessagesWithRetry = async (
  publicKeyBase58Check: string,
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  let decryptedMessageEntries = await decryptAccessGroupMessages(
    messages,
    accessGroups
  );

  // Naive approach to figuring out which access groups we need to fetch.
  const accessGroupsToFetch = decryptedMessageEntries.filter(
    (dmr) => dmr.error === "Error: access group key not found for group message"
  );
  if (accessGroupsToFetch.length > 0) {
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
};

export const decryptAccessGroupMessages = (
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<DecryptedMessageEntryResponse[]> => {
  return Promise.all(
    (messages || []).map((m) => identity.decryptMessage(m, accessGroups))
  );
};

export const encryptAndSendNewMessage = async (
  messageToSend: string,
  senderPublicKeyBase58Check: string,
  RecipientPublicKeyBase58Check: string,
  RecipientMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  SenderMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME
): Promise<string> => {
  if (SenderMessagingKeyName !== DEFAULT_KEY_MESSAGING_GROUP_NAME) {
    return Promise.reject("sender must use default key for now");
  }

  const response = await checkPartyAccessGroups({
    SenderPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientPublicKeyBase58Check: RecipientPublicKeyBase58Check,
    RecipientAccessGroupKeyName: RecipientMessagingKeyName,
  });

  if (!response.SenderAccessGroupKeyName) {
    return Promise.reject("SenderAccessGroupKeyName is undefined");
  }

  let message: string;
  let isUnencrypted = false;
  const ExtraData: { [k: string]: string } = {};
  if (response.RecipientAccessGroupKeyName) {
    message = await identity.encryptMessage(
      response.RecipientAccessGroupPublicKeyBase58Check,
      messageToSend
    );
  } else {
    message = bytesToHex(new TextEncoder().encode(messageToSend));
    isUnencrypted = true;
    ExtraData["unencrypted"] = "true";
  }

  if (!message) {
    return Promise.reject("error encrypting message");
  }

  const requestBody = {
    SenderAccessGroupOwnerPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupPublicKeyBase58Check:
      response.SenderAccessGroupPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientAccessGroupOwnerPublicKeyBase58Check:
      RecipientPublicKeyBase58Check,
    RecipientAccessGroupPublicKeyBase58Check: isUnencrypted
      ? response.RecipientPublicKeyBase58Check
      : response.RecipientAccessGroupPublicKeyBase58Check,
    RecipientAccessGroupKeyName: response.RecipientAccessGroupKeyName,
    ExtraData,
    EncryptedMessageText: message,
    MinFeeRateNanosPerKB: 1000,
  };

  const isDM =
    !RecipientMessagingKeyName ||
    RecipientMessagingKeyName === DEFAULT_KEY_MESSAGING_GROUP_NAME;

  const { submittedTransactionResponse } = await (isDM
    ? sendDMMessage(requestBody)
    : sendGroupChatMessage(requestBody));

  if (!submittedTransactionResponse) {
    throw new Error("Failed to submit transaction for sending message.");
  }

  return submittedTransactionResponse.TxnHashHex;
};

export async function fetchPaginatedDmThreadMessages(
  payload: GetPaginatedMessagesForDmThreadRequest,
  accessGroups: AccessGroupEntryResponse[],
  options: {
    beforeTimestampNanos?: number;
    limit?: number;
  } = {}
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
}> {
  const { beforeTimestampNanos, limit = payload.MaxMessagesToFetch ?? 10 } = options;

  // Validate timestamp is safe to use
  const safeTimestamp = beforeTimestampNanos && Number.isSafeInteger(beforeTimestampNanos)
    ? beforeTimestampNanos
    : undefined;

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchPaginatedDmThreadMessages] 🚀 Attempting GraphQL fetch", {
      userPublicKey: payload.UserGroupOwnerPublicKeyBase58Check,
      counterPartyPublicKey: payload.PartyGroupOwnerPublicKeyBase58Check,
      beforeTimestampNanos: safeTimestamp,
      originalTimestamp: beforeTimestampNanos,
      isSafe: beforeTimestampNanos ? Number.isSafeInteger(beforeTimestampNanos) : 'N/A',
      limit,
    });
  }

  try {
    const nodes = await fetchDmMessagesViaGraphql({
      userPublicKey: payload.UserGroupOwnerPublicKeyBase58Check,
      counterPartyPublicKey: payload.PartyGroupOwnerPublicKeyBase58Check,
      beforeTimestampNanos: safeTimestamp,
      limit,
    });

    const publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap =
      {};

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[fetchPaginatedDmThreadMessages] graphql nodes", {
        count: nodes.length,
        nodes,
      });
    }

    const rawMessages = nodes
      .map((node, index) => {
        const senderPublicKey =
          node.senderAccessGroupOwnerPublicKey ??
          node.sender?.publicKey ??
          "";
        const recipientPublicKey =
          node.recipientAccessGroupOwnerPublicKey ??
          node.receiver?.publicKey ??
          "";
        const {
          nanos: timestampNanos,
          nanosString: timestampNanosString,
        } = normalizeTimestampToNanos(node.timestamp);

        if (typeof __DEV__ !== "undefined" && __DEV__ && index === 0) {
          console.log("[fetchPaginatedDmThreadMessages] First node structure", {
            senderAccessGroupPublicKey: node.senderAccessGroupPublicKey,
            recipientAccessGroupPublicKey: node.recipientAccessGroupPublicKey,
            senderAccessGroupOwnerPublicKey: node.senderAccessGroupOwnerPublicKey,
            recipientAccessGroupOwnerPublicKey: node.recipientAccessGroupOwnerPublicKey,
          });
        }

        if (node.sender?.publicKey) {
          publicKeyToProfileEntryResponseMap[node.sender.publicKey] =
            buildDefaultProfileEntry(
              node.sender.publicKey,
              node.sender.username ?? undefined
            );
        }

        if (node.receiver?.publicKey) {
          publicKeyToProfileEntryResponseMap[node.receiver.publicKey] =
            buildDefaultProfileEntry(
              node.receiver.publicKey,
              node.receiver.username ?? undefined
            );
        }

        if (!node.encryptedText || !senderPublicKey || !recipientPublicKey) {
          return null;
        }

        const senderAccessGroupPublicKey =
          node.senderAccessGroupPublicKey ?? "";
        const recipientAccessGroupPublicKey =
          node.recipientAccessGroupPublicKey ?? "";

        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.log("[fetchPaginatedDmThreadMessages] Access group keys", {
            senderAccessGroupPublicKey,
            recipientAccessGroupPublicKey,
            hasSenderKey: !!senderAccessGroupPublicKey,
            hasRecipientKey: !!recipientAccessGroupPublicKey,
          });
        }

        return {
          ChatType: ChatType.DM,
          SenderInfo: {
            OwnerPublicKeyBase58Check: senderPublicKey,
            AccessGroupPublicKeyBase58Check: senderAccessGroupPublicKey,
            AccessGroupKeyName:
              node.senderAccessGroup?.accessGroupKeyName ??
              DEFAULT_KEY_MESSAGING_GROUP_NAME,
          },
          RecipientInfo: {
            OwnerPublicKeyBase58Check: recipientPublicKey,
            AccessGroupPublicKeyBase58Check: recipientAccessGroupPublicKey,
            AccessGroupKeyName:
              node.receiverAccessGroup?.accessGroupKeyName ??
              DEFAULT_KEY_MESSAGING_GROUP_NAME,
          },
          MessageInfo: {
            EncryptedText: node.encryptedText,
            TimestampNanos: timestampNanos,
            TimestampNanosString: timestampNanosString,
            ExtraData: {},
          },
        } as NewMessageEntryResponse;
      })
      .filter(
        (message): message is NewMessageEntryResponse =>
          Boolean(message?.MessageInfo?.EncryptedText)
      );

    if (rawMessages.length === 0) {
      return {
        decrypted: [],
        updatedAllAccessGroups: accessGroups,
        publicKeyToProfileEntryResponseMap,
      };
    }

    const { decrypted, updatedAllAccessGroups } =
      await decryptAccessGroupMessagesWithRetry(
        payload.UserGroupOwnerPublicKeyBase58Check,
        rawMessages,
        accessGroups
      );

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[fetchPaginatedDmThreadMessages] ✅ GraphQL fetch SUCCESS", {
        count: decrypted.length,
        decrypted,
      });
    }

    return {
      decrypted,
      updatedAllAccessGroups,
      publicKeyToProfileEntryResponseMap,
    };
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[fetchPaginatedDmThreadMessages] GraphQL query failed, falling back to REST endpoint",
        error
      );
    }
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchPaginatedDmThreadMessages] 🔄 Using REST API fallback");
  }

  const response = await getPaginatedMessagesForDmThread(payload);
  const rawMessages = response.Messages ?? (response as any).ThreadMessages ?? [];
  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      payload.UserGroupOwnerPublicKeyBase58Check,
      rawMessages,
      accessGroups
    );

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchPaginatedDmThreadMessages] ✅ REST API fetch SUCCESS", {
      count: decrypted.length,
    });
  }

  return {
    decrypted,
    updatedAllAccessGroups,
    publicKeyToProfileEntryResponseMap:
      response.PublicKeyToProfileEntryResponse,
  };
}

export async function fetchPaginatedGroupThreadMessages(
  payload: GetPaginatedMessagesForGroupThreadRequest,
  accessGroups: AccessGroupEntryResponse[],
  loggedInUserPublicKey?: string
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
}> {
  const response = await getPaginatedMessagesForGroupThread(payload);
  const rawMessages = (response as any).GroupChatMessages ?? response.Messages ?? (response as any).ThreadMessages ?? [];
  
  // Use the logged-in user's public key for fetching access groups, not the payload's UserPublicKeyBase58Check
  const publicKeyForAccessGroups = loggedInUserPublicKey || payload.UserPublicKeyBase58Check;
  
  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      publicKeyForAccessGroups,
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
