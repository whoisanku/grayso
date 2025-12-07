const DEFAULT_FOCUS_GRAPHQL_URL = "https://graphql.focus.xyz/graphql";

const INBOX_THREADS_QUERY = `
  query InboxMessageThreadsByPublicKey(
    $userPublicKey: String!
    $first: Int
    $orderBy: [FilterableMessageThreadsOrderBy!]
    $filter: FilterableMessageThreadFilter
    $offset: Int
  ) {
    filterableMessageThreads(
      condition: { participantPublicKey: $userPublicKey }
      orderBy: $orderBy
      first: $first
      filter: $filter
      offset: $offset
    ) {
      nodes {
        initiatorPublicKey
        threadIdentifier
        isSpam
        requiredPaymentAmountUsdCents
        thread {
          isGroupChatMessage
          accessGroupKeyName
          accessGroupOwnerPublicKey
          threadIdentifier
          messages(first: 1, orderBy: TIMESTAMP_DESC) {
            nodes {
              id
              encryptedText
              timestamp
              extraData
              isGroupChatMessage
              threadIdentifier
              sender {
                publicKey
                username
                extraData
                accessGroupsOwned(
                  condition: { accessGroupKeyName: "default-key" }
                  first: 1
                ) {
                  nodes {
                    accessGroupPublicKey
                    accessGroupKeyName
                    accessGroupOwnerPublicKey
                  }
                }
              }
              receiver {
                publicKey
                username
                extraData
                accessGroupsOwned(
                  condition: { accessGroupKeyName: "default-key" }
                  first: 1
                ) {
                  nodes {
                    accessGroupPublicKey
                    accessGroupKeyName
                    accessGroupOwnerPublicKey
                  }
                }
              }
            }
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
        hasPreviousPage
        startCursor
      }
    }
  }
`;

type AccessGroupNode = {
  accessGroupPublicKey?: string | null;
  accessGroupKeyName?: string | null;
  accessGroupOwnerPublicKey?: string | null;
};

type AccountNode = {
  publicKey?: string | null;
  username?: string | null;
  extraData?: Record<string, string> | null;
  accessGroupsOwned?: {
    nodes?: AccessGroupNode[] | null;
  } | null;
};

export type FocusMessageNode = {
  id?: string | null;
  encryptedText?: string | null;
  timestamp?: string | number | null;
  extraData?: Record<string, string> | null;
  isGroupChatMessage?: boolean | null;
  threadIdentifier?: string | null;
  sender?: AccountNode | null;
  receiver?: AccountNode | null;
};

export type FocusThreadNode = {
  initiatorPublicKey?: string | null;
  threadIdentifier?: string | null;
  isSpam?: boolean | null;
  requiredPaymentAmountUsdCents?: string | null;
  thread?: {
    isGroupChatMessage?: boolean | null;
    accessGroupKeyName?: string | null;
    accessGroupOwnerPublicKey?: string | null;
    threadIdentifier?: string | null;
    messages?: { nodes?: FocusMessageNode[] | null } | null;
  } | null;
};

type FocusPageInfo = {
  endCursor?: string | null;
  hasNextPage?: boolean | null;
  hasPreviousPage?: boolean | null;
  startCursor?: string | null;
};

type FocusInboxResponse = {
  data?: {
    filterableMessageThreads?: {
      nodes?: FocusThreadNode[] | null;
      pageInfo?: FocusPageInfo | null;
    } | null;
  } | null;
  errors?: Array<{ message?: string }> | null;
};

async function performGraphqlRequest(
  body: Record<string, unknown>,
  graphqlEndpoint: string
): Promise<Response> {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const response = await fetch(graphqlEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (response.status !== 405) {
    return response;
  }

  const url = new URL(graphqlEndpoint);
  url.searchParams.set("query", String(body.query ?? ""));
  if (body.variables) {
    url.searchParams.set("variables", JSON.stringify(body.variables));
  }

  return fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}

export async function fetchInboxMessageThreads({
  userPublicKey,
  first = 20,
  offset = 0,
  orderBy = ["LATEST_MESSAGE_TIMESTAMP_DESC"],
  filter = {
    isSpam: { equalTo: false },
    initiator: { isBlacklisted: { equalTo: false } },
  },
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
    DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  userPublicKey: string;
  first?: number;
  offset?: number;
  orderBy?: string[];
  filter?: Record<string, unknown>;
  graphqlEndpoint?: string;
}): Promise<{
  nodes: FocusThreadNode[];
  pageInfo: FocusPageInfo;
}> {
  const variables: Record<string, unknown> = {
    userPublicKey,
    first,
    offset,
    orderBy,
    filter,
  };

  const body = {
    operationName: "InboxMessageThreadsByPublicKey",
    query: INBOX_THREADS_QUERY,
    variables,
  };

  const response = await performGraphqlRequest(body, graphqlEndpoint);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from GraphQL endpoint but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120
      )}`
    );
  }

  const json = (await response.json()) as FocusInboxResponse;

  if (json.errors?.length) {
    throw new Error(
      json.errors.map((err) => err.message).filter(Boolean).join("; ") ||
        "GraphQL query returned errors"
    );
  }

  const nodes = json.data?.filterableMessageThreads?.nodes ?? [];
  const pageInfo = json.data?.filterableMessageThreads?.pageInfo ?? {};

  return {
    nodes: Array.isArray(nodes) ? nodes : [],
    pageInfo,
  };
}
