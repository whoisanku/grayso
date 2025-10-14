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
