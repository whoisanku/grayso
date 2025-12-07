import { NewMessageEntryResponse, type PublicKeyToProfileEntryResponseMap } from "deso-protocol";

const DEFAULT_NODE_URL = "https://node.deso.org/api/v0";

const baseUrl = process.env.EXPO_PUBLIC_DESO_NODE_URL ?? DEFAULT_NODE_URL;

async function postJson<TResponse>(endpoint: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(`${baseUrl}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `DeSo API request failed: ${response.status} ${response.statusText} - ${text}`
    );
  }

  return response.json() as Promise<TResponse>;
}

// --- Message Threads ---

export type GetAllUserMessageThreadsRequest = {
  UserPublicKeyBase58Check: string;
};

export type GetAllUserMessageThreadsResponse = {
  MessageThreads?: NewMessageEntryResponse[];
  ThreadMessages?: NewMessageEntryResponse[];
  PublicKeyToProfileEntryResponse: PublicKeyToProfileEntryResponseMap;
};

export function getAllUserMessageThreads(
  payload: GetAllUserMessageThreadsRequest
): Promise<GetAllUserMessageThreadsResponse> {
  return postJson<GetAllUserMessageThreadsResponse>(
    "get-all-user-message-threads",
    payload
  );
}

export type GetPaginatedMessagesForDmThreadRequest = {
  UserGroupOwnerPublicKeyBase58Check: string;
  UserGroupKeyName: string;
  PartyGroupOwnerPublicKeyBase58Check: string;
  PartyGroupKeyName: string;
  StartTimeStamp?: number;
  StartTimeStampString?: string;
  MaxMessagesToFetch?: number;
};

export type PaginatedMessagesResponse = {
  GroupChatMessages?: NewMessageEntryResponse[];
  Messages?: NewMessageEntryResponse[];
  ThreadMessages?: NewMessageEntryResponse[];
  PublicKeyToProfileEntryResponse: PublicKeyToProfileEntryResponseMap;
};

export function getPaginatedMessagesForDmThread(
  payload: GetPaginatedMessagesForDmThreadRequest
): Promise<PaginatedMessagesResponse> {
  return postJson<PaginatedMessagesResponse>(
    "get-paginated-messages-for-dm-thread",
    payload
  );
}

export type GetPaginatedMessagesForGroupThreadRequest = {
  UserPublicKeyBase58Check: string;
  AccessGroupKeyName: string;
  StartTimeStamp?: number;
  StartTimeStampString?: string;
  MaxMessagesToFetch?: number;
};

export function getPaginatedMessagesForGroupThread(
  payload: GetPaginatedMessagesForGroupThreadRequest
): Promise<PaginatedMessagesResponse> {
  return postJson<PaginatedMessagesResponse>(
    "get-paginated-messages-for-group-chat-thread",
    payload
  );
}

// --- Access Groups ---

export type CreateAccessGroupRequest = {
  AccessGroupOwnerPublicKeyBase58Check: string;
  AccessGroupPublicKeyBase58Check: string;
  AccessGroupKeyName: string;
  MinFeeRateNanosPerKB: number;
  ExtraData?: { [key: string]: string };
  TransactionFees?: any[];
};

export type AccessGroupTransactionResponse = {
  TotalInputNanos: number;
  ChangeAmountNanos: number;
  FeeNanos: number;
  Transaction: any;
  TransactionHex: string;
};

export function createAccessGroup(
  payload: CreateAccessGroupRequest
): Promise<AccessGroupTransactionResponse> {
  return postJson<AccessGroupTransactionResponse>(
    "create-access-group",
    payload
  );
}

export type AccessGroupMember = {
  AccessGroupMemberPublicKeyBase58Check: string;
  AccessGroupMemberKeyName: string;
  EncryptedKey: string;
  ExtraData?: { [key: string]: string };
};

export type AddAccessGroupMembersRequest = {
  AccessGroupOwnerPublicKeyBase58Check: string;
  AccessGroupKeyName: string;
  AccessGroupMemberList: AccessGroupMember[];
  MinFeeRateNanosPerKB: number;
  ExtraData?: { [key: string]: string };
  TransactionFees?: any[];
};

export function addAccessGroupMembers(
  payload: AddAccessGroupMembersRequest
): Promise<AccessGroupTransactionResponse> {
  return postJson<AccessGroupTransactionResponse>(
    "add-access-group-members",
    payload
  );
}

export type SubmitTransactionRequest = {
  TransactionHex: string;
};

export type SubmitTransactionResponse = {
  TransactionHex: string;
  TxnHashHex: string;
  PostEntryResponse?: any;
};

export function submitTransaction(
  payload: SubmitTransactionRequest
): Promise<SubmitTransactionResponse> {
  return postJson<SubmitTransactionResponse>(
    "submit-transaction",
    payload
  );
}
