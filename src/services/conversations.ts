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
  fetchGroupMessagesViaGraphql,
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
  allAccessGroups: AccessGroupEntryResponse[],
  decryptMessageFn?: (message: any, accessGroups: any[]) => Promise<any>
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  const {
    decrypted,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
  } = await getConversationNew(
    userPublicKeyBase58Check,
    allAccessGroups,
    decryptMessageFn
  );
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
  allAccessGroups: AccessGroupEntryResponse[],
  decryptMessageFn?: (message: any, accessGroups: any[]) => Promise<any>
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
      allAccessGroups,
      decryptMessageFn
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
  accessGroups: AccessGroupEntryResponse[],
  decryptMessageFn?: (message: any, accessGroups: any[]) => Promise<any>
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
}> => {
  let decryptedMessageEntries = await decryptAccessGroupMessages(
    messages,
    accessGroups,
    decryptMessageFn
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
      accessGroups,
      decryptMessageFn
    );
  }

  return {
    decrypted: decryptedMessageEntries,
    updatedAllAccessGroups: accessGroups,
  };
};

export const decryptAccessGroupMessages = (
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[],
  decryptMessageFn: (message: any, accessGroups: any[]) => Promise<any> = (m, ag) => identity.decryptMessage(m, ag)
): Promise<DecryptedMessageEntryResponse[]> => {
  return Promise.all(
    (messages || []).map((m) => decryptMessageFn(m, accessGroups))
  );
};

export const encryptAndSendNewMessage = async (
  messageToSend: string,
  senderPublicKeyBase58Check: string,
  RecipientPublicKeyBase58Check: string,
  RecipientMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  SenderMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  RecipientAccessGroupPublicKeyBase58Check?: string
): Promise<string> => {
  if (SenderMessagingKeyName !== DEFAULT_KEY_MESSAGING_GROUP_NAME) {
    return Promise.reject("sender must use default key for now");
  }

  console.log("[encryptAndSendNewMessage] Inputs:", {
    messageToSend,
    senderPublicKeyBase58Check,
    RecipientPublicKeyBase58Check,
    RecipientMessagingKeyName,
    SenderMessagingKeyName,
    RecipientAccessGroupPublicKeyBase58Check,
  });

  const response = await checkPartyAccessGroups({
    SenderPublicKeyBase58Check: senderPublicKeyBase58Check,
    SenderAccessGroupKeyName: SenderMessagingKeyName,
    RecipientPublicKeyBase58Check: RecipientPublicKeyBase58Check,
    RecipientAccessGroupKeyName: RecipientMessagingKeyName,
  });

  if (!response.SenderAccessGroupKeyName) {
    return Promise.reject("SenderAccessGroupKeyName is undefined");
  }

  console.log("[encryptAndSendNewMessage] checkPartyAccessGroups response:", response);

  let message: string;
  let isUnencrypted = false;
  const ExtraData: { [k: string]: string } = {};
  const effectiveRecipientGroupKeyName =
    response.RecipientAccessGroupKeyName || RecipientMessagingKeyName;

  if (effectiveRecipientGroupKeyName) {
    message = await identity.encryptMessage(
      response.RecipientAccessGroupPublicKeyBase58Check || RecipientAccessGroupPublicKeyBase58Check || "",
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
      : (response.RecipientAccessGroupPublicKeyBase58Check || RecipientAccessGroupPublicKeyBase58Check || ""),
    RecipientAccessGroupKeyName:
      response.RecipientAccessGroupKeyName || RecipientMessagingKeyName,
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
    afterCursor?: string | null;
    limit?: number;
    fallbackBeforeTimestampNanos?: number;
  } = {},
  decryptMessageFn?: (message: any, accessGroups: any[]) => Promise<any>
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}> {
  const {
    afterCursor,
    limit = payload.MaxMessagesToFetch ?? 10,
    fallbackBeforeTimestampNanos,
  } = options;

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchPaginatedDmThreadMessages] 🚀 Attempting GraphQL fetch", {
      userPublicKey: payload.UserGroupOwnerPublicKeyBase58Check,
      counterPartyPublicKey: payload.PartyGroupOwnerPublicKeyBase58Check,
      afterCursor,
      limit,
    });
  }

  try {
    const { nodes, pageInfo } = await fetchDmMessagesViaGraphql({
      userPublicKey: payload.UserGroupOwnerPublicKeyBase58Check,
      counterPartyPublicKey: payload.PartyGroupOwnerPublicKeyBase58Check,
      limit,
      afterCursor,
    });

    const publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap =
      {};

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[fetchPaginatedDmThreadMessages] graphql nodes", {
        count: nodes.length,
        nodes,
        pageInfo,
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
              node.sender.username ?? undefined,
              node.sender.profilePic ?? undefined
            );
        }

        if (node.receiver?.publicKey) {
          publicKeyToProfileEntryResponseMap[node.receiver.publicKey] =
            buildDefaultProfileEntry(
              node.receiver.publicKey,
              node.receiver.username ?? undefined,
              node.receiver.profilePic ?? undefined
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
        pageInfo,
      };
    }

    let { decrypted, updatedAllAccessGroups } =
      await decryptAccessGroupMessagesWithRetry(
        payload.UserGroupOwnerPublicKeyBase58Check,
        rawMessages,
        accessGroups,
        decryptMessageFn  // Pass custom decrypt function
      );

    if (
      !pageInfo?.hasNextPage &&
      fallbackBeforeTimestampNanos &&
      decrypted.length > 0
    ) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.log(
          "[fetchPaginatedDmThreadMessages] GraphQL reported no next page, attempting REST fallback",
          {
            fallbackBeforeTimestampNanos,
          }
        );
      }

      const restPayload: GetPaginatedMessagesForDmThreadRequest = {
        ...payload,
        StartTimeStamp: fallbackBeforeTimestampNanos,
        StartTimeStampString: String(fallbackBeforeTimestampNanos),
        MaxMessagesToFetch: limit,
      };

      const restResponse = await getPaginatedMessagesForDmThread(restPayload);
      const restRawMessages =
        restResponse.Messages ?? (restResponse as any).ThreadMessages ?? [];
      const restDecryptResult = await decryptAccessGroupMessagesWithRetry(
        payload.UserGroupOwnerPublicKeyBase58Check,
        restRawMessages,
        updatedAllAccessGroups,
        decryptMessageFn  // Pass custom decrypt function
      );

      updatedAllAccessGroups = restDecryptResult.updatedAllAccessGroups;

      const dedupeMap = new Map<string, DecryptedMessageEntryResponse>();
      const appendWithKey = (
        msgs: DecryptedMessageEntryResponse[],
        source: string
      ): void => {
        msgs.forEach((msg, idx) => {
          const baseKey =
            msg.MessageInfo?.TimestampNanosString ??
            String(msg.MessageInfo?.TimestampNanos ?? "");
          const senderKey =
            msg.SenderInfo?.OwnerPublicKeyBase58Check ?? "unknown-sender";
          const encryptedText = msg.MessageInfo?.EncryptedText ?? "";
          const key = `${baseKey}-${senderKey}-${encryptedText}-${source}-${idx}`;
          dedupeMap.set(key, msg);
        });
      };

      appendWithKey(decrypted, "graphql");
      appendWithKey(restDecryptResult.decrypted, "rest");

      decrypted = Array.from(dedupeMap.values());

      Object.assign(
        publicKeyToProfileEntryResponseMap,
        restResponse.PublicKeyToProfileEntryResponse
      );

      let pageInfoLocal = pageInfo;
      pageInfoLocal = {
        hasNextPage: restDecryptResult.decrypted.length === limit,
        endCursor:
          restDecryptResult.decrypted.length === limit
            ? restDecryptResult.decrypted[
                restDecryptResult.decrypted.length - 1
              ]?.MessageInfo?.TimestampNanosString ?? null
            : null,
      };
    }

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[fetchPaginatedDmThreadMessages] ✅ GraphQL fetch SUCCESS", {
        count: decrypted.length,
        pageInfo,
      });
    }

    return {
      decrypted,
      updatedAllAccessGroups,
      publicKeyToProfileEntryResponseMap,
      pageInfo,
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
      accessGroups,
      decryptMessageFn  // Pass custom decrypt function
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
    pageInfo: {
      hasNextPage: false,
      endCursor: null,
    },
  };
}

export async function fetchPaginatedGroupThreadMessages(
  payload: GetPaginatedMessagesForGroupThreadRequest,
  accessGroups: AccessGroupEntryResponse[],
  options: {
    afterCursor?: string | null;
    beforeCursor?: string | null;
    limit?: number;
    recipientAccessGroupOwnerPublicKey?: string | null;
  } = {},
  loggedInUserPublicKey?: string,
  decryptMessageFn?: (message: any, accessGroups: any[]) => Promise<any>
): Promise<{
  decrypted: DecryptedMessageEntryResponse[];
  updatedAllAccessGroups: AccessGroupEntryResponse[];
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}> {
  const {
    afterCursor,
    beforeCursor,
    limit = payload.MaxMessagesToFetch ?? 10,
    recipientAccessGroupOwnerPublicKey,
  } = options;

  const publicKeyForAccessGroups =
    loggedInUserPublicKey || payload.UserPublicKeyBase58Check;

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchPaginatedGroupThreadMessages] 🚀 Attempting GraphQL fetch", {
      accessGroupKeyName: payload.AccessGroupKeyName,
      recipientAccessGroupOwnerPublicKey,
      afterCursor,
      limit,
    });
  }

  try {
    const { nodes, pageInfo } = await fetchGroupMessagesViaGraphql({
      accessGroupKeyName: payload.AccessGroupKeyName,
      accessGroupOwnerPublicKey: recipientAccessGroupOwnerPublicKey ?? undefined,
      limit,
      afterCursor,
      beforeCursor,
    });

    const publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap =
      {};

    const rawMessages = nodes
      .map((node) => {
        const senderPublicKey =
          node.senderAccessGroupOwnerPublicKey ??
          node.sender?.publicKey ??
          "";
        const recipientPublicKey =
          node.recipientAccessGroupOwnerPublicKey ??
          node.receiver?.publicKey ??
          "";

        if (!node.encryptedText || !senderPublicKey || !recipientPublicKey) {
          return null;
        }

        const {
          nanos: timestampNanos,
          nanosString: timestampNanosString,
        } = normalizeTimestampToNanos(node.timestamp);

        const senderAccessGroupKeyName =
          node.senderAccessGroupKeyName ??
          node.senderAccessGroup?.accessGroupKeyName ??
          DEFAULT_KEY_MESSAGING_GROUP_NAME;
        const recipientAccessGroupKeyName =
          node.recipientAccessGroupKeyName ??
          node.receiverAccessGroup?.accessGroupKeyName ??
          payload.AccessGroupKeyName ??
          DEFAULT_KEY_MESSAGING_GROUP_NAME;

        if (node.sender?.publicKey) {
          publicKeyToProfileEntryResponseMap[node.sender.publicKey] =
            buildDefaultProfileEntry(
              node.sender.publicKey,
              node.sender.username ?? undefined,
              node.sender.profilePic ?? undefined
            );
        }

        if (node.receiver?.publicKey) {
          publicKeyToProfileEntryResponseMap[node.receiver.publicKey] =
            buildDefaultProfileEntry(
              node.receiver.publicKey,
              node.receiver.username ?? undefined,
              node.receiver.profilePic ?? undefined
            );
        }

        return {
          ChatType: ChatType.GROUPCHAT,
          SenderInfo: {
            OwnerPublicKeyBase58Check: senderPublicKey,
            AccessGroupPublicKeyBase58Check:
              node.senderAccessGroupPublicKey ?? "",
            AccessGroupKeyName: senderAccessGroupKeyName,
          },
          RecipientInfo: {
            OwnerPublicKeyBase58Check: recipientPublicKey,
            AccessGroupPublicKeyBase58Check:
              node.recipientAccessGroupPublicKey ?? "",
            AccessGroupKeyName: recipientAccessGroupKeyName,
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
        pageInfo,
      };
    }

    const { decrypted, updatedAllAccessGroups } =
      await decryptAccessGroupMessagesWithRetry(
        publicKeyForAccessGroups,
        rawMessages,
        accessGroups,
        decryptMessageFn  // Pass custom decrypt function
      );

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[fetchPaginatedGroupThreadMessages] ✅ GraphQL fetch SUCCESS", {
        count: decrypted.length,
        hasNextPage: pageInfo.hasNextPage,
        endCursor: pageInfo.endCursor,
      });
    }

    return {
      decrypted,
      updatedAllAccessGroups,
      publicKeyToProfileEntryResponseMap,
      pageInfo,
    };
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[fetchPaginatedGroupThreadMessages] GraphQL query failed, falling back to REST endpoint",
        error
      );
    }
  }

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchPaginatedGroupThreadMessages] 🔄 Using REST API fallback");
  }

  const response = await getPaginatedMessagesForGroupThread(payload);
  const rawMessages =
    (response as any).GroupChatMessages ??
    response.Messages ??
    (response as any).ThreadMessages ??
    [];

  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      publicKeyForAccessGroups,
      rawMessages,
      accessGroups,
      decryptMessageFn  // Pass custom decrypt function
    );

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchPaginatedGroupThreadMessages] ✅ REST API fetch SUCCESS", {
      count: decrypted.length,
    });
  }

  return {
    decrypted,
    updatedAllAccessGroups,
    publicKeyToProfileEntryResponseMap:
      response.PublicKeyToProfileEntryResponse,
    pageInfo: {
      hasNextPage: false,
      endCursor: null,
    },
  };
}
