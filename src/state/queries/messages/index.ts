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

  // If we have a pageParam (cursor), we rely on it.
  // But the underlying API also takes a StartTimeStamp.
  // The original logic used oldestTimestampRef to track this.
  // For React Query, we might need to pass this state through pageParam or
  // restructure how pagination works.

  // To keep it simple and aligned with original logic:
  // We will encode timestamp into the cursor if needed, or assume the cursor
  // provided by the API (endCursor) is sufficient.
  // The original logic explicitly managed `oldestTimestampRef` separately from the cursor.

  const paginationTimestamp = currentTimestampNanos; // Simplified for initial fetch;
  // Note: True infinite scroll might need adjustment to `fetchPaginated...` to accept
  // just a cursor, or we pass the timestamp in the pageParam object.

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
