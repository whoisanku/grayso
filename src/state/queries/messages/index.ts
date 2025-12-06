import {
  ChatType,
  DecryptedMessageEntryResponse,
  PublicKeyToProfileEntryResponseMap,
} from "deso-protocol";
import {
  fetchPaginatedDmThreadMessages,
  fetchPaginatedGroupThreadMessages,
} from "../../../services/conversations";
import {
  DEFAULT_KEY_MESSAGING_GROUP_NAME,
  MESSAGE_PAGE_SIZE,
} from "../../../constants/messaging";
import { normalizeAndSortMessages } from "../../../utils/messageUtils";

type MessagesQueryKey = readonly [
  "messages",
  string, // conversationId
  string, // userPublicKey
  string, // threadPublicKey
  ChatType,
];

export const getMessagesQueryKey = (
  conversationId: string,
  userPublicKey: string,
  threadPublicKey: string,
  chatType: ChatType
): MessagesQueryKey =>
  [
    "messages",
    conversationId,
    userPublicKey,
    threadPublicKey,
    chatType,
  ] as const;

interface FetchMessagesParams {
  pageParam?: string | null;
  userPublicKey: string;
  threadPublicKey: string;
  chatType: ChatType;
  threadAccessGroupKeyName?: string;
  userAccessGroupKeyName?: string;
  partyGroupOwnerPublicKeyBase58Check?: string;
  oldestTimestampRef?: number | null;
}

export const fetchMessages = async ({
  pageParam,
  userPublicKey,
  threadPublicKey,
  chatType,
  threadAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  userAccessGroupKeyName = DEFAULT_KEY_MESSAGING_GROUP_NAME,
  partyGroupOwnerPublicKeyBase58Check,
  oldestTimestampRef,
}: FetchMessagesParams) => {
  const isGroupChat = chatType === ChatType.GROUPCHAT;
  const counterPartyPublicKey = partyGroupOwnerPublicKeyBase58Check ?? threadPublicKey;

  // Calculate timestamp for pagination
  const nowMs = Date.now();
  const currentTimestampNanos = nowMs * 1_000_000;

  // For pagination: if we have a cursor (pageParam), it's the timestamp of the oldest
  // message from the previous page. Use it to fetch messages BEFORE that timestamp.
  // Otherwise, use current time for the initial fetch (get newest messages first).
  let paginationTimestamp = currentTimestampNanos;
  if (pageParam) {
    // The cursor is often a timestamp string - try to parse it
    const parsedCursor = Number(pageParam);
    if (!Number.isNaN(parsedCursor) && parsedCursor > 0) {
      paginationTimestamp = parsedCursor;
    }
  }

  if (isGroupChat) {
     const groupOwnerPublicKey =
        partyGroupOwnerPublicKeyBase58Check ??
        counterPartyPublicKey ??
        userPublicKey;

     const payload = {
        UserPublicKeyBase58Check: groupOwnerPublicKey,
        AccessGroupKeyName: threadAccessGroupKeyName,
        MaxMessagesToFetch: MESSAGE_PAGE_SIZE,
        StartTimeStamp: paginationTimestamp,
        StartTimeStampString: String(paginationTimestamp),
     } as const;

     const result = await fetchPaginatedGroupThreadMessages(
        payload,
        [], // We might need accessGroups here? Original logic kept a ref.
        userPublicKey,
        {
           afterCursor: pageParam ?? null,
           limit: MESSAGE_PAGE_SIZE,
           recipientAccessGroupOwnerPublicKey: groupOwnerPublicKey,
        }
     );
     return result;
  } else {
     const payload = {
        UserGroupOwnerPublicKeyBase58Check: userPublicKey,
        UserGroupKeyName: userAccessGroupKeyName,
        PartyGroupOwnerPublicKeyBase58Check: counterPartyPublicKey,
        PartyGroupKeyName: threadAccessGroupKeyName,
        MaxMessagesToFetch: MESSAGE_PAGE_SIZE,
        StartTimeStamp: paginationTimestamp,
        StartTimeStampString: String(paginationTimestamp),
     } as const;

     const result = await fetchPaginatedDmThreadMessages(
        payload,
        [], // accessGroups
        {
           afterCursor: pageParam ?? null,
           limit: MESSAGE_PAGE_SIZE,
           fallbackBeforeTimestampNanos: pageParam ? paginationTimestamp : undefined,
        }
     );
     return result;
  }
};
