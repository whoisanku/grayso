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
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "@/constants/messaging";
import {
  getPaginatedMessagesForDmThread,
  getPaginatedMessagesForGroupThread,
  GetPaginatedMessagesForDmThreadRequest,
  GetPaginatedMessagesForGroupThreadRequest,
} from "@/lib/deso/api";
import {
  buildDefaultProfileEntry,

  fetchDmMessagesViaGraphql,
  fetchGroupMessagesViaGraphql,
  GroupMember,
  normalizeTimestampToNanos,
} from "@/lib/deso/graphql";
import { fetchInboxMessageThreads } from "@/lib/focus/graphql";

const USER_TO_SEND_MESSAGE_TO = ""; // Add a public key here

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

const coerceSpamFlag = (value: unknown): boolean => {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
};

const hasExplicitSpamFlag = (value: unknown): boolean =>
  value !== undefined && value !== null;

export type Conversation = {
  firstMessagePublicKey: string;
  messages: DecryptedMessageEntryResponse[];
  ChatType: ChatType;
};

export type ConversationMap = Record<string, Conversation>;

export type ThreadMeta = {
  isSpam: boolean;
  requiredPaymentAmountUsdCents?: string | null;
};

export type ThreadMetaMap = Record<string, ThreadMeta>;

const pickGroupImageFromExtraData = (
  extraData?: Record<string, string> | null
): string | undefined => {
  if (!extraData) {
    return undefined;
  }

  return (
    extraData.groupImage ||
    extraData.GroupImageURL ||
    extraData.groupImageURL ||
    extraData.groupImageUrl ||
    extraData.GroupImageUrl ||
    extraData.LargeProfilePicURL ||
    extraData.FeaturedImageURL ||
    undefined
  );
};

const buildConversationMapFromMessages = (
  decrypted: DecryptedMessageEntryResponse[]
): ConversationMap => {
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
        (
          a: DecryptedMessageEntryResponse,
          b: DecryptedMessageEntryResponse
        ) =>
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

export const getAllConversationsFromFocusGraphql = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[],
  offset = 0,
  first = 20
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
  hasMore: boolean;
  groupMembers: Record<string, GroupMember[]>;
  groupExtraData: Record<string, Record<string, string> | null>;
  threadMeta: ThreadMetaMap;
}> => {
  const { nodes: threadNodes, pageInfo } = await fetchInboxMessageThreads({
    userPublicKey: userPublicKeyBase58Check,
    isSpam: null,
    first,
    offset,
  });

  const threadMeta: ThreadMetaMap = {};
  const publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap =
    {};

  const groupMembersMap: Record<string, GroupMember[]> = {};
  const groupExtraDataMap: Record<string, Record<string, string> | null> = {};


  const rawMessages: NewMessageEntryResponse[] = threadNodes
    .map((thread) => {
      const message = thread.thread?.messages?.nodes?.[0];
      if (!message?.encryptedText) {
        return null;
      }

      const threadIdentifier = thread.threadIdentifier || "";
      if (threadIdentifier) {
        threadMeta[threadIdentifier] = {
          isSpam: coerceSpamFlag(thread.isSpam),
          requiredPaymentAmountUsdCents:
            thread.requiredPaymentAmountUsdCents ?? null,
        };
      }

      const senderAccount = message.sender;
      const receiverAccount = message.receiver;
      const senderPublicKey =
        senderAccount?.publicKey || thread.initiatorPublicKey || "";
      const receiverPublicKey = receiverAccount?.publicKey || "";

      const { nanos, nanosString } = normalizeTimestampToNanos(
        message.timestamp ?? 0
      );

      if (senderAccount?.publicKey) {
        publicKeyToProfileEntryResponseMap[senderAccount.publicKey] =
          buildDefaultProfileEntry(
            senderAccount.publicKey,
            senderAccount.username ?? undefined,
            pickProfilePicFromExtraData(senderAccount.extraData)
          );
      }

      if (receiverAccount?.publicKey) {
        publicKeyToProfileEntryResponseMap[receiverAccount.publicKey] =
          buildDefaultProfileEntry(
            receiverAccount.publicKey,
            receiverAccount.username ?? undefined,
            pickProfilePicFromExtraData(receiverAccount.extraData)
          );
      }

      if (!senderPublicKey || (!receiverPublicKey && !thread.thread?.isGroupChatMessage)) {
        return null;
      }

      const isGroupChat = Boolean(
        thread.thread?.isGroupChatMessage || message.isGroupChatMessage
      );
      const chatType = isGroupChat ? ChatType.GROUPCHAT : ChatType.DM;

      const senderGroup = pickDefaultAccessGroup(
        senderAccount || undefined,
        senderPublicKey
      );
      const senderAccessGroupPublicKey =
        findAccessGroupPublicKey(allAccessGroups, senderGroup.owner, senderGroup.keyName) ||
        senderGroup.publicKey ||
        "";

      const recipientGroup = isGroupChat
        ? {
          keyName:
            thread.thread?.accessGroupKeyName ||
            DEFAULT_KEY_MESSAGING_GROUP_NAME,
          owner:
            thread.thread?.accessGroupOwnerPublicKey ||
            receiverPublicKey ||
            senderPublicKey,
          publicKey: null as string | null,
        }
        : pickDefaultAccessGroup(receiverAccount || undefined, receiverPublicKey);


      const recipientAccessGroupPublicKey =
        findAccessGroupPublicKey(
          allAccessGroups,
          recipientGroup.owner,
          recipientGroup.keyName
        ) ||
        recipientGroup.publicKey ||
        "";

      return {
        ChatType: chatType,
        SenderInfo: {
          OwnerPublicKeyBase58Check: senderPublicKey,
          AccessGroupPublicKeyBase58Check: senderAccessGroupPublicKey,
          AccessGroupKeyName: senderGroup.keyName,
        },
        RecipientInfo: {
          OwnerPublicKeyBase58Check: recipientGroup.owner,
          AccessGroupPublicKeyBase58Check: recipientAccessGroupPublicKey,
          AccessGroupKeyName: recipientGroup.keyName,
        },
        MessageInfo: {
          EncryptedText: message.encryptedText,
          TimestampNanos: nanos,
          TimestampNanosString: nanosString,
          ExtraData: {
            ...(message.extraData || {}),
            threadIdentifier,
          },
        },
      } as NewMessageEntryResponse;
    })
    .filter(
      (message): message is NewMessageEntryResponse =>
        Boolean(message?.MessageInfo?.EncryptedText)
    );

  if (rawMessages.length === 0) {
    return {
      conversations: {},
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups: allAccessGroups,
      hasMore: false,
      groupMembers: groupMembersMap,
      groupExtraData: groupExtraDataMap,
      threadMeta,
    };
  }



  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      userPublicKeyBase58Check,
      rawMessages,
      allAccessGroups
    );

  // Populate groupExtraDataMap from updatedAllAccessGroups
  updatedAllAccessGroups.forEach((group) => {
    const key = `${group.AccessGroupOwnerPublicKeyBase58Check}-${group.AccessGroupKeyName}`;
    if (group.ExtraData) {
      groupExtraDataMap[key] = group.ExtraData;
    }
  });

  const conversations = buildConversationMapFromMessages(decrypted);

  return {
    conversations,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
    hasMore: Boolean(pageInfo?.hasNextPage),
    groupMembers: groupMembersMap,
    groupExtraData: groupExtraDataMap,
    threadMeta,
  };
};

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
  const conversations = buildConversationMapFromMessages(decrypted);
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
      const { TxnHashHex: txnHashHex } = await encryptAndSendNewMessage(
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

export const findAccessGroupPublicKey = (
  allAccessGroups: AccessGroupEntryResponse[],
  ownerPublicKey: string,
  keyName: string
): string | null => {
  const match = allAccessGroups.find(
    (group) =>
      group.AccessGroupOwnerPublicKeyBase58Check === ownerPublicKey &&
      group.AccessGroupKeyName === keyName
  );

  return match?.AccessGroupPublicKeyBase58Check || null;
};

const pickProfilePicFromExtraData = (
  extraData?: Record<string, string> | null
): string | undefined => {
  if (!extraData) {
    return undefined;
  }

  return (
    extraData.LargeProfilePicURL ||
    extraData.FeaturedImageURL ||
    extraData.ProfilePicUrl ||
    extraData.NFTProfilePictureUrl ||
    undefined
  );
};

const pickDefaultAccessGroup = (
  account?: {
    accessGroupsOwned?: {
      nodes?: Array<{
        accessGroupPublicKey?: string | null;
        accessGroupKeyName?: string | null;
        accessGroupOwnerPublicKey?: string | null;
      }> | null;
    } | null;
  },
  fallbackOwner?: string | null
): {
  keyName: string;
  owner: string;
  publicKey?: string | null;
} => {
  const firstGroup = account?.accessGroupsOwned?.nodes?.find(
    (entry) => Boolean(entry)
  );

  return {
    keyName:
      firstGroup?.accessGroupKeyName || DEFAULT_KEY_MESSAGING_GROUP_NAME,
    owner: firstGroup?.accessGroupOwnerPublicKey || fallbackOwner || "",
    publicKey: firstGroup?.accessGroupPublicKey,
  };
};

export const getConversationsFromFocusGraphql = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[],
  offset = 0,
  first = 20
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
  hasMore: boolean;
  groupMembers: Record<string, GroupMember[]>;
  groupExtraData: Record<string, Record<string, string> | null>;
}> => {
  const { nodes: threadNodes, pageInfo } = await fetchInboxMessageThreads({
    userPublicKey: userPublicKeyBase58Check,
    isSpam: false,
    first,
    offset,
  });

  const publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap =
    {};

  // Store per-group metadata so the home screen can render avatars immediately.
  const groupMembersMap: Record<string, GroupMember[]> = {};
  const groupExtraDataMap: Record<string, Record<string, string> | null> = {};


  const rawMessages: NewMessageEntryResponse[] = threadNodes
    .map((thread) => {
      const isSpam = coerceSpamFlag(thread.isSpam);
      if (isSpam) {
        return null;
      }

      const message = thread.thread?.messages?.nodes?.[0];
      if (!message?.encryptedText) {
        return null;
      }

      const senderAccount = message.sender;
      const receiverAccount = message.receiver;
      const senderPublicKey =
        senderAccount?.publicKey || thread.initiatorPublicKey || "";
      const receiverPublicKey = receiverAccount?.publicKey || "";

      const { nanos, nanosString } = normalizeTimestampToNanos(
        message.timestamp ?? 0
      );

      if (senderAccount?.publicKey) {
        publicKeyToProfileEntryResponseMap[senderAccount.publicKey] =
          buildDefaultProfileEntry(
            senderAccount.publicKey,
            senderAccount.username ?? undefined,
            pickProfilePicFromExtraData(senderAccount.extraData)
          );
      }

      if (receiverAccount?.publicKey) {
        publicKeyToProfileEntryResponseMap[receiverAccount.publicKey] =
          buildDefaultProfileEntry(
            receiverAccount.publicKey,
            receiverAccount.username ?? undefined,
            pickProfilePicFromExtraData(receiverAccount.extraData)
          );
      }

      if (!senderPublicKey || (!receiverPublicKey && !thread.thread?.isGroupChatMessage)) {
        return null;
      }

      const isGroupChat = Boolean(
        thread.thread?.isGroupChatMessage || message.isGroupChatMessage
      );
      const chatType = isGroupChat ? ChatType.GROUPCHAT : ChatType.DM;

      const senderGroup = pickDefaultAccessGroup(senderAccount || undefined, senderPublicKey);
      const senderAccessGroupPublicKey =
        findAccessGroupPublicKey(
          allAccessGroups,
          senderGroup.owner,
          senderGroup.keyName
        ) || senderGroup.publicKey || "";

      const recipientGroup = isGroupChat
        ? {
          keyName:
            thread.thread?.accessGroupKeyName ||
            DEFAULT_KEY_MESSAGING_GROUP_NAME,
          owner:
            thread.thread?.accessGroupOwnerPublicKey ||
            receiverPublicKey ||
            senderPublicKey,
          publicKey: null as string | null,
        }
        : pickDefaultAccessGroup(receiverAccount || undefined, receiverPublicKey);



      const recipientAccessGroupPublicKey =
        findAccessGroupPublicKey(
          allAccessGroups,
          recipientGroup.owner,
          recipientGroup.keyName
        ) || recipientGroup.publicKey || "";

      return {
        ChatType: chatType,
        SenderInfo: {
          OwnerPublicKeyBase58Check: senderPublicKey,
          AccessGroupPublicKeyBase58Check: senderAccessGroupPublicKey,
          AccessGroupKeyName: senderGroup.keyName,
        },
        RecipientInfo: {
          OwnerPublicKeyBase58Check: recipientGroup.owner,
          AccessGroupPublicKeyBase58Check: recipientAccessGroupPublicKey,
          AccessGroupKeyName: recipientGroup.keyName,
        },
        MessageInfo: {
          EncryptedText: message.encryptedText,
          TimestampNanos: nanos,
          TimestampNanosString: nanosString,
          ExtraData: {
            ...(message.extraData || {}),
            threadIdentifier: thread.threadIdentifier || "",
          },
        },
      } as NewMessageEntryResponse;
    })
    .filter(
      (message): message is NewMessageEntryResponse =>
        Boolean(message?.MessageInfo?.EncryptedText)
    );

  if (rawMessages.length === 0) {
    return {
      conversations: {},
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups: allAccessGroups,
      hasMore: false,
      groupMembers: groupMembersMap,
      groupExtraData: groupExtraDataMap,
    };
  }

  // Wait for any member fetches to complete in parallel with decryption.


  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      userPublicKeyBase58Check,
      rawMessages,
      allAccessGroups
    );

  const conversations = buildConversationMapFromMessages(decrypted);

  return {
    conversations,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
    hasMore: Boolean(pageInfo?.hasNextPage),
    groupMembers: groupMembersMap,
    groupExtraData: groupExtraDataMap,
  };
};

export const getSpamConversationsFromFocusGraphql = async (
  userPublicKeyBase58Check: string,
  allAccessGroups: AccessGroupEntryResponse[],
  offset = 0,
  first = 20
): Promise<{
  conversations: ConversationMap;
  publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap;
  updatedAllAccessGroups: AccessGroupEntryResponse[];
  hasMore: boolean;
  groupMembers: Record<string, GroupMember[]>;
  groupExtraData: Record<string, Record<string, string> | null>;
}> => {
  devLog("[SPAM DEBUG] Fetching spam conversations", {
    userPublicKeyBase58Check,
    offset,
    first,
  });

  const { nodes: threadNodes, pageInfo } = await fetchInboxMessageThreads({
    userPublicKey: userPublicKeyBase58Check,
    isSpam: true,
    first,
    offset,
  });

  devLog("[SPAM DEBUG] Received thread nodes:", threadNodes.length);

  // Log isSpam values for all threads to understand what the API returns
  threadNodes.forEach((thread, index) => {
    devLog(`[SPAM DEBUG] Thread ${index}:`, {
      threadIdentifier: thread.threadIdentifier,
      isSpam: thread.isSpam,
      normalizedIsSpam: coerceSpamFlag(thread.isSpam),
      isSpamType: typeof thread.isSpam,
      initiator: thread.initiatorPublicKey?.substring(0, 10) + '...'
    });
  });

  const publicKeyToProfileEntryResponseMap: PublicKeyToProfileEntryResponseMap =
    {};

  const groupMembersMap: Record<string, GroupMember[]> = {};
  const groupExtraDataMap: Record<string, Record<string, string> | null> = {};


  const rawMessages: NewMessageEntryResponse[] = threadNodes
    .map((thread) => {
      // CRITICAL: Mirror inbox logic (inverted)
      // Inbox filters OUT spam (thread.isSpam === true)
      // Spam filters OUT non-spam (thread.isSpam !== true)
      // This keeps only threads where isSpam is explicitly true
      const isSpam = coerceSpamFlag(thread.isSpam);
      if (hasExplicitSpamFlag(thread.isSpam) && !isSpam) {
        devLog(
          "[SPAM DEBUG] Filtering out non-spam thread (isSpam =",
          thread.isSpam,
          "):",
          thread.threadIdentifier
        );
        return null;
      }

      const message = thread.thread?.messages?.nodes?.[0];
      if (!message?.encryptedText) {
        return null;
      }

      const senderAccount = message.sender;
      const receiverAccount = message.receiver;
      const senderPublicKey =
        senderAccount?.publicKey || thread.initiatorPublicKey || "";
      const receiverPublicKey = receiverAccount?.publicKey || "";

      const { nanos, nanosString } = normalizeTimestampToNanos(
        message.timestamp ?? 0
      );

      if (senderAccount?.publicKey) {
        publicKeyToProfileEntryResponseMap[senderAccount.publicKey] =
          buildDefaultProfileEntry(
            senderAccount.publicKey,
            senderAccount.username ?? undefined,
            pickProfilePicFromExtraData(senderAccount.extraData)
          );
      }

      if (receiverAccount?.publicKey) {
        publicKeyToProfileEntryResponseMap[receiverAccount.publicKey] =
          buildDefaultProfileEntry(
            receiverAccount.publicKey,
            receiverAccount.username ?? undefined,
            pickProfilePicFromExtraData(receiverAccount.extraData)
          );
      }

      if (!senderPublicKey || (!receiverPublicKey && !thread.thread?.isGroupChatMessage)) {
        return null;
      }

      const isGroupChat = Boolean(
        thread.thread?.isGroupChatMessage || message.isGroupChatMessage
      );
      const chatType = isGroupChat ? ChatType.GROUPCHAT : ChatType.DM;

      const senderGroup = pickDefaultAccessGroup(senderAccount || undefined, senderPublicKey);
      const senderAccessGroupPublicKey =
        findAccessGroupPublicKey(
          allAccessGroups,
          senderGroup.owner,
          senderGroup.keyName
        ) || senderGroup.publicKey || "";

      const recipientGroup = isGroupChat
        ? {
          keyName:
            thread.thread?.accessGroupKeyName ||
            DEFAULT_KEY_MESSAGING_GROUP_NAME,
          owner:
            thread.thread?.accessGroupOwnerPublicKey ||
            receiverPublicKey ||
            senderPublicKey,
          publicKey: null as string | null,
        }
        : pickDefaultAccessGroup(receiverAccount || undefined, receiverPublicKey);



      const recipientAccessGroupPublicKey =
        findAccessGroupPublicKey(
          allAccessGroups,
          recipientGroup.owner,
          recipientGroup.keyName
        ) || recipientGroup.publicKey || "";

      return {
        ChatType: chatType,
        SenderInfo: {
          OwnerPublicKeyBase58Check: senderPublicKey,
          AccessGroupPublicKeyBase58Check: senderAccessGroupPublicKey,
          AccessGroupKeyName: senderGroup.keyName,
        },
        RecipientInfo: {
          OwnerPublicKeyBase58Check: recipientGroup.owner,
          AccessGroupPublicKeyBase58Check: recipientAccessGroupPublicKey,
          AccessGroupKeyName: recipientGroup.keyName,
        },
        MessageInfo: {
          EncryptedText: message.encryptedText,
          TimestampNanos: nanos,
          TimestampNanosString: nanosString,
          ExtraData: {
            ...(message.extraData || {}),
            threadIdentifier: thread.threadIdentifier || "",
          },
        },
      } as NewMessageEntryResponse;
    })
    .filter(
      (message): message is NewMessageEntryResponse =>
        Boolean(message?.MessageInfo?.EncryptedText)
    );

  devLog("[SPAM DEBUG] Raw messages after filtering:", rawMessages.length);
  if (rawMessages.length > 0) {
    devLog("[SPAM DEBUG] First raw message:", rawMessages[0]);
  }

  if (rawMessages.length === 0) {
    devLog("[SPAM DEBUG] No raw messages found, returning empty");
    return {
      conversations: {},
      publicKeyToProfileEntryResponseMap,
      updatedAllAccessGroups: allAccessGroups,
      hasMore: false,
      groupMembers: groupMembersMap,
      groupExtraData: groupExtraDataMap,
    };
  }



  const { decrypted, updatedAllAccessGroups } =
    await decryptAccessGroupMessagesWithRetry(
      userPublicKeyBase58Check,
      rawMessages,
      allAccessGroups
    );

  devLog("[SPAM DEBUG] Decrypted messages:", decrypted.length);
  if (decrypted.length > 0) {
    devLog("[SPAM DEBUG] First decrypted message:", decrypted[0]);
  }

  const conversations = buildConversationMapFromMessages(decrypted);

  devLog(
    "[SPAM DEBUG] Final conversations count:",
    Object.keys(conversations).length
  );
  devLog("[SPAM DEBUG] Conversation keys:", Object.keys(conversations));

  return {
    conversations,
    publicKeyToProfileEntryResponseMap,
    updatedAllAccessGroups,
    hasMore: Boolean(pageInfo?.hasNextPage),
    groupMembers: groupMembersMap,
    groupExtraData: groupExtraDataMap,
  };
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

export const decryptAccessGroupMessages = async (
  messages: NewMessageEntryResponse[],
  accessGroups: AccessGroupEntryResponse[]
): Promise<DecryptedMessageEntryResponse[]> => {
  const decrypted = await Promise.all(
    (messages || []).map(async (m) => {
      // First, decrypt the main message content
      const decryptedMessage = await identity.decryptMessage(m, accessGroups);
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.log("💬 [Text Decryption] Result");
      }

      // TODO: Re-enable image decryption once the access group issue is resolved.
      // // Now, check for and decrypt image URLs if they exist
      const encryptedImageURLs = decryptedMessage.MessageInfo?.ExtraData?.encryptedImageURLs as string | undefined;
      if (encryptedImageURLs) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.log("🖼️ [Image Message] Encrypted image payload detected");
        }

        try {
          const decryptedImages = await identity.decryptMessage(
            {
              ...decryptedMessage,
              MessageInfo: {
                ...decryptedMessage.MessageInfo,
                EncryptedText: encryptedImageURLs,
              },
            } as NewMessageEntryResponse,
            accessGroups
          );

          if (decryptedImages.DecryptedMessage) {
            if (!decryptedMessage.MessageInfo.ExtraData) {
              decryptedMessage.MessageInfo.ExtraData = {};
            }
            decryptedMessage.MessageInfo.ExtraData.decryptedImageURLs = decryptedImages.DecryptedMessage;
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.log("📸 [Image Decryption Succeeded]");
            }
          } else {
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.warn("🚨 [Image Decryption] Empty result");
            }
          }
        } catch (e) {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.warn("🚨 [Image Decryption] Failed to decrypt image URLs", e);
          }
        }
      }

      const encryptedVideoURLs = decryptedMessage.MessageInfo?.ExtraData?.encryptedVideoURLs as string | undefined;
      if (encryptedVideoURLs) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.log("🎞️ [Video Message] Encrypted video payload detected");
        }

        try {
          const decryptedVideos = await identity.decryptMessage(
            {
              ...decryptedMessage,
              MessageInfo: {
                ...decryptedMessage.MessageInfo,
                EncryptedText: encryptedVideoURLs,
              },
            } as NewMessageEntryResponse,
            accessGroups
          );

          if (decryptedVideos.DecryptedMessage) {
            if (!decryptedMessage.MessageInfo.ExtraData) {
              decryptedMessage.MessageInfo.ExtraData = {};
            }
            decryptedMessage.MessageInfo.ExtraData.decryptedVideoURLs = decryptedVideos.DecryptedMessage;
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.log("📽️ [Video Decryption Succeeded]");
            }
          } else {
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.warn("🚨 [Video Decryption] Empty result");
            }
          }
        } catch (e) {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.warn("🚨 [Video Decryption] Failed to decrypt video URLs", e);
          }
        }
      }

      return decryptedMessage;
    })
  );

  // Attempt to decrypt embedded reply messages if present
  await Promise.all(
    decrypted.map(async (d) => {
      const encryptedReply =
        d.MessageInfo?.ExtraData?.RepliedToMessageEncryptedText;

      if (encryptedReply && !d.MessageInfo?.ExtraData?.RepliedToMessageDecryptedText) {
        try {
          // Construct a temporary message object using the parent's metadata
          // but with the embedded encrypted text.
          // We assume the reply was encrypted with the same access group context.
          const fakeMessage: NewMessageEntryResponse = {
            ...d,
            MessageInfo: {
              ...d.MessageInfo,
              EncryptedText: encryptedReply,
            },
          } as NewMessageEntryResponse; // Casting because d has extra fields

          const decryptedReply = await identity.decryptMessage(
            fakeMessage,
            accessGroups
          );

          if (decryptedReply.DecryptedMessage) {
            // Mutate the original message's ExtraData to include the decrypted text
            if (!d.MessageInfo) {
              d.MessageInfo = { EncryptedText: "", TimestampNanos: 0, TimestampNanosString: "", ExtraData: {} };
            }
            if (!d.MessageInfo.ExtraData) {
              d.MessageInfo.ExtraData = {};
            }
            d.MessageInfo.ExtraData.RepliedToMessageDecryptedText =
              decryptedReply.DecryptedMessage;
          }
        } catch (e) {
          console.warn("Failed to decrypt embedded reply:", e);
        }
      }
    })
  );


  return decrypted;
};

export const encryptAndSendNewMessage = async (
  messageToSend: string,
  senderPublicKeyBase58Check: string,
  RecipientPublicKeyBase58Check: string,
  RecipientMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  SenderMessagingKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  RecipientAccessGroupPublicKeyBase58Check?: string,
  extraData?: { [k: string]: string },
  imageURLs?: string[],
  videoURLs?: string[]
): Promise<{
  TxnHashHex: string;
  EncryptedMessageText: string;
  ExtraData: { [k: string]: string };
  SenderAccessGroupPublicKeyBase58Check: string;
  SenderAccessGroupKeyName: string;
  RecipientAccessGroupPublicKeyBase58Check: string;
  RecipientAccessGroupKeyName: string;
}> => {
  if (SenderMessagingKeyName !== DEFAULT_KEY_MESSAGING_GROUP_NAME) {
    return Promise.reject("sender must use default key for now");
  }

  devLog("[encryptAndSendNewMessage] Inputs:", {
    messageToSend,
    senderPublicKeyBase58Check,
    RecipientPublicKeyBase58Check,
    RecipientMessagingKeyName,
    SenderMessagingKeyName,
    RecipientAccessGroupPublicKeyBase58Check,
    extraData,
    imageURLs,
    videoURLs,
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

  devLog("[encryptAndSendNewMessage] checkPartyAccessGroups response:", response);

  let message: string;
  let isUnencrypted = false;
  const ExtraData: { [k: string]: string } = { ...extraData };
  const effectiveRecipientGroupKeyName =
    response.RecipientAccessGroupKeyName || RecipientMessagingKeyName;

  const recipientKeyToUse = response.RecipientAccessGroupPublicKeyBase58Check || RecipientAccessGroupPublicKeyBase58Check || "";

  if (effectiveRecipientGroupKeyName) {
    message = await identity.encryptMessage(
      recipientKeyToUse,
      messageToSend
    );
  } else {
    message = bytesToHex(new TextEncoder().encode(messageToSend));
    isUnencrypted = true;
    ExtraData["unencrypted"] = "true";
  }

  // Encrypt Image URLs if present
  if (imageURLs && imageURLs.length > 0) {
    const imagesJson = JSON.stringify(imageURLs);
    let encryptedImages = "";
    if (effectiveRecipientGroupKeyName) {
      encryptedImages = await identity.encryptMessage(
        recipientKeyToUse,
        imagesJson
      );
    } else {
      encryptedImages = bytesToHex(new TextEncoder().encode(imagesJson));
    }
    ExtraData["encryptedImageURLs"] = encryptedImages;
  }

  // Encrypt Video URLs if present
  if (videoURLs && videoURLs.length > 0) {
    const videosJson = JSON.stringify(videoURLs);
    let encryptedVideos = "";
    if (effectiveRecipientGroupKeyName) {
      encryptedVideos = await identity.encryptMessage(
        recipientKeyToUse,
        videosJson
      );
    } else {
      encryptedVideos = bytesToHex(new TextEncoder().encode(videosJson));
    }
    ExtraData["encryptedVideoURLs"] = encryptedVideos;
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

  return {
    TxnHashHex: submittedTransactionResponse.TxnHashHex,
    EncryptedMessageText: message,
    ExtraData,
    SenderAccessGroupPublicKeyBase58Check: requestBody.SenderAccessGroupPublicKeyBase58Check || "",
    SenderAccessGroupKeyName: requestBody.SenderAccessGroupKeyName || "",
    RecipientAccessGroupPublicKeyBase58Check: requestBody.RecipientAccessGroupPublicKeyBase58Check || "",
    RecipientAccessGroupKeyName: requestBody.RecipientAccessGroupKeyName || "",
  };
};

export async function fetchPaginatedDmThreadMessages(
  payload: GetPaginatedMessagesForDmThreadRequest,
  accessGroups: AccessGroupEntryResponse[],
  options: {
    afterCursor?: string | null;
    limit?: number;
    fallbackBeforeTimestampNanos?: number;
  } = {}
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
  let nextPageInfo: { hasNextPage: boolean; endCursor: string | null } | null = null;

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
      // console.log("[fetchPaginatedDmThreadMessages] graphql nodes", {
      //   count: nodes.length,
      //   nodes,
      //   pageInfo,
      // });
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
            ExtraData: node.extraData ?? {},
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
        accessGroups
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
        updatedAllAccessGroups
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

      nextPageInfo = {
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
      pageInfo: nextPageInfo ?? pageInfo,
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

  // Compute pagination info for REST fallback
  const pageLimit = payload.MaxMessagesToFetch ?? 10;
  const receivedFullPage = decrypted.length >= pageLimit;
  const oldestMessage = decrypted[decrypted.length - 1];
  const endCursor = oldestMessage?.MessageInfo?.TimestampNanosString ?? null;

  return {
    decrypted,
    updatedAllAccessGroups,
    publicKeyToProfileEntryResponseMap:
      response.PublicKeyToProfileEntryResponse,
    pageInfo: {
      hasNextPage: receivedFullPage,
      endCursor: receivedFullPage ? endCursor : null,
    },
  };
}

export const fetchProfilesBatch = async (
  publicKeys: string[]
): Promise<PublicKeyToProfileEntryResponseMap> => {
  if (!publicKeys.length) return {};

  const uniqueKeys = Array.from(new Set(publicKeys.filter(Boolean)));
  const results: PublicKeyToProfileEntryResponseMap = {};

  await Promise.all(
    uniqueKeys.map(async (pk) => {
      try {
        const response = await fetch(
          `https://node.deso.org/api/v0/get-single-profile?PublicKeyBase58Check=${pk}`
        );
        const json = await response.json();
        const profile = json?.ProfileEntryResponse;
        if (profile) {
          results[pk] = profile as PublicKeyToProfileEntryResponseMap[string];
        }
      } catch (error) {
        console.warn('[fetchProfilesBatch] Failed for', pk, error);
      }
    })
  );

  return results;
};

export async function fetchPaginatedGroupThreadMessages(
  payload: GetPaginatedMessagesForGroupThreadRequest,
  accessGroups: AccessGroupEntryResponse[],
  loggedInUserPublicKey?: string,
  options: {
    afterCursor?: string | null;
    beforeCursor?: string | null;
    limit?: number;
    recipientAccessGroupOwnerPublicKey?: string | null;
  } = {}
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
            ExtraData: node.extraData ?? {},
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
        accessGroups
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
      accessGroups
    );

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchPaginatedGroupThreadMessages] ✅ REST API fetch SUCCESS", {
      count: decrypted.length,
    });
  }

  // Compute pagination info for REST fallback
  const pageLimit = payload.MaxMessagesToFetch ?? 10;
  const receivedFullPage = decrypted.length >= pageLimit;
  const oldestMessage = decrypted[decrypted.length - 1];
  const endCursor = oldestMessage?.MessageInfo?.TimestampNanosString ?? null;

  return {
    decrypted,
    updatedAllAccessGroups,
    publicKeyToProfileEntryResponseMap:
      response.PublicKeyToProfileEntryResponse,
    pageInfo: {
      hasNextPage: receivedFullPage,
      endCursor: receivedFullPage ? endCursor : null,
    },
  };
}
