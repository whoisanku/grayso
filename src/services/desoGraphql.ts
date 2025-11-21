import type { ProfileEntryResponse } from "deso-protocol";

const DEFAULT_GRAPHQL_URL = "https://graphql-prod.deso.com/graphql";

const GRAPHQL_QUERY = `
  query Messages(
    $filter: MessageFilter
    $orderBy: [MessagesOrderBy!]
    $first: Int
    $before: Cursor
    $after: Cursor
  ) {
    messages(
      filter: $filter
      orderBy: $orderBy
      first: $first
      before: $before
      after: $after
    ) {
      nodes {
        encryptedText
        timestamp
        senderAccessGroupOwnerPublicKey
        recipientAccessGroupOwnerPublicKey
        senderAccessGroupPublicKey
        recipientAccessGroupPublicKey
        senderAccessGroupKeyName
        recipientAccessGroupKeyName
        id
        extraData
        isGroupChatMessage
        senderAccessGroup {
          accessGroupKeyName
        }
        receiverAccessGroup {
          accessGroupKeyName
        }
        sender {
          username
          publicKey
          profilePic
        }
        receiver {
          username
          publicKey
          profilePic
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const FOLLOWING_QUERY = `
  query AccountByUsername($publicKey: String!, $before: Cursor, $after: Cursor) {
    account(publicKey: $publicKey) {
      following(before: $before, after: $after) {
        nodes {
          followee {
            username
            profilePic
            publicKey
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
  }
`;

const ACCESS_GROUPS_QUERY = `
  query AccessGroups(
    $filter: AccessGroupFilter
    $first: Int
    $after: Cursor
  ) {
    accessGroups(filter: $filter, first: $first, after: $after) {
      nodes {
        accessGroupMembers {
          nodes {
            member {
              username
              publicKey
              profilePic
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type GraphqlMessageNode = {
  id: string;
  chatType?: string | null;
  encryptedText?: string | null;
  timestamp?: string | number | null;
  senderAccessGroupOwnerPublicKey?: string | null;
  recipientAccessGroupOwnerPublicKey?: string | null;
  senderAccessGroupPublicKey?: string | null;
  recipientAccessGroupPublicKey?: string | null;
  senderAccessGroupKeyName?: string | null;
  recipientAccessGroupKeyName?: string | null;
  extraData?: Record<string, string> | null;
  senderAccessGroup?: {
    accessGroupKeyName?: string | null;
  } | null;
  receiverAccessGroup?: {
    accessGroupKeyName?: string | null;
  } | null;
  sender?: {
    username?: string | null;
    publicKey?: string | null;
    profilePic?: string | null;
  } | null;
  receiver?: {
    username?: string | null;
    publicKey?: string | null;
    profilePic?: string | null;
  } | null;
  isGroupChatMessage?: boolean | null;
};

export type GroupMember = {
  username?: string | null;
  publicKey: string;
  profilePic?: string | null;
};

type AccessGroupMembersNode = {
  member: GroupMember;
};

type AccessGroupNode = {
  accessGroupMembers?: {
    nodes?: AccessGroupMembersNode[];
    pageInfo?: {
      hasNextPage?: boolean;
      endCursor?: string | null;
    };
  };
};

export function normalizeTimestampToNanos(
  value: string | number | null | undefined
): { nanos: number; nanosString: string } {
  if (typeof value === "number" && Number.isFinite(value)) {
    const nanos = Math.trunc(value);
    return { nanos, nanosString: String(nanos) };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return { nanos: 0, nanosString: "0" };
    }

    if (/^\d+$/.test(trimmed)) {
      const nanos = Number.parseInt(trimmed, 10);
      return {
        nanos: Number.isNaN(nanos) ? 0 : nanos,
        nanosString: String(nanos),
      };
    }

    const isoMatch = trimmed.match(
      /^(.+?)(?:\.(\d+))?([zZ]|[+-]\d\d:?(\d\d)?)?$/
    );

    if (isoMatch) {
      const [, isoBase, fractionalDigits = "", zone = "Z"] = isoMatch;
      const isoWithoutFraction = `${isoBase}${zone ?? "Z"}`;
      const millis = Date.parse(isoWithoutFraction);

      if (!Number.isNaN(millis)) {
        const paddedFraction = fractionalDigits
          .replace(/\D/g, "")
          .padEnd(9, "0")
          .slice(0, 9);

        const nanosFraction = paddedFraction
          ? Number.parseInt(paddedFraction, 10)
          : 0;

        const nanos = Math.max(
          0,
          Math.floor(millis) * 1_000_000 + nanosFraction
        );

        return { nanos, nanosString: String(nanos) };
      }
    }
  }

  return { nanos: 0, nanosString: "0" };
}

type GraphqlMessagesResponse = {
  data?: {
    messages?: {
      nodes?: GraphqlMessageNode[];
      pageInfo?: {
        hasNextPage?: boolean | null;
        endCursor?: string | null;
      } | null;
    } | null;
  } | null;
  errors?: { message?: string }[];
};

type FetchDmMessagesInput = {
  userPublicKey: string;
  counterPartyPublicKey: string;
  limit: number;
  isGroupChat?: boolean;
  afterCursor?: string | null;
  beforeCursor?: string | null;
  graphqlEndpoint?: string;
};

async function performGraphqlRequest(
  body: Record<string, unknown>,
  graphqlEndpoint: string
): Promise<Response> {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.status !== 405) {
      return response;
    }
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[desoGraphql] POST request failed, falling back to GET", {
        error,
      });
    }
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

export async function fetchDmMessagesViaGraphql({
  userPublicKey,
  counterPartyPublicKey,
  limit,
  afterCursor,
  beforeCursor,
  graphqlEndpoint = process.env.EXPO_PUBLIC_DESO_GRAPHQL_URL ??
    DEFAULT_GRAPHQL_URL,
}: FetchDmMessagesInput): Promise<{
  nodes: GraphqlMessageNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}> {
  const participantsFilter = [
    {
      and: [
        {
          recipientAccessGroupOwnerPublicKey: {
            equalTo: counterPartyPublicKey,
          },
        },
        {
          senderAccessGroupOwnerPublicKey: {
            equalTo: userPublicKey,
          },
        },
      ],
    },
    {
      and: [
        {
          recipientAccessGroupOwnerPublicKey: {
            equalTo: userPublicKey,
          },
        },
        {
          senderAccessGroupOwnerPublicKey: {
            equalTo: counterPartyPublicKey,
          },
        },
      ],
    },
  ];

  const filter: Record<string, unknown> = {
    or: participantsFilter,
    isGroupChatMessage: { equalTo: false },
  };

  const variables: Record<string, unknown> = {
    filter,
    orderBy: ["TIMESTAMP_DESC"],
  };

  if (Number.isFinite(limit) && limit > 0) {
    variables.first = limit;
  }

  if (afterCursor) {
    variables.after = afterCursor;
  }

  if (beforeCursor) {
    variables.before = beforeCursor;
  }

  const body = {
    query: GRAPHQL_QUERY,
    variables,
  };

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchDmMessagesViaGraphql] request payload", {
      userPublicKey,
      counterPartyPublicKey,
      variables: body.variables,
    });
  }

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

  const json = (await response.json()) as GraphqlMessagesResponse;

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchDmMessagesViaGraphql] raw response", {
      status: response.status,
      json,
    });
  }

  if (json.errors?.length) {
    const message = json.errors.map((err) => err.message).join("; ");
    throw new Error(message || "GraphQL query returned errors");
  }

  const nodes = json.data?.messages?.nodes ?? [];
  const pageInfo = json.data?.messages?.pageInfo ?? {};

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchDmMessagesViaGraphql] messages nodes", {
      count: Array.isArray(nodes) ? nodes.length : 0,
      firstNode: Array.isArray(nodes) ? nodes[0] : null,
      pageInfo,
    });
  }
  if (!Array.isArray(nodes)) {
    return {
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    };
  }

  return {
    nodes,
    pageInfo: {
      hasNextPage: Boolean(pageInfo?.hasNextPage),
      endCursor:
        typeof pageInfo?.endCursor === "string" ? pageInfo.endCursor : null,
    },
  };
}

export async function fetchFollowingViaGraphql({
  publicKey,
  limit,
  afterCursor,
  beforeCursor,
  graphqlEndpoint = process.env.EXPO_PUBLIC_DESO_GRAPHQL_URL ??
    DEFAULT_GRAPHQL_URL,
}: {
  publicKey: string;
  limit?: number;
  afterCursor?: string | null;
  beforeCursor?: string | null;
  graphqlEndpoint?: string;
}): Promise<{
  following: {
    username?: string | null;
    profilePic?: string | null;
    publicKey: string;
  }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}> {
  const variables: Record<string, unknown> = {
    publicKey,
  };

  if (afterCursor) {
    variables.after = afterCursor;
  }

  if (beforeCursor) {
    variables.before = beforeCursor;
  }

  const body = {
    query: FOLLOWING_QUERY,
    variables,
  };

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchFollowingViaGraphql] request payload", {
      publicKey,
      variables,
    });
  }

  const response = await performGraphqlRequest(body, graphqlEndpoint);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from GraphQL endpoint but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120
      )}…`
    );
  }

  const json = (await response.json()) as {
    data?: {
      account?: {
        following?: {
          nodes?: {
            followee?: {
              username?: string | null;
              profilePic?: string | null;
              publicKey: string;
            };
          }[];
          pageInfo?: {
            endCursor?: string | null;
            hasNextPage?: boolean;
          };
        };
      };
    };
    errors?: Array<{ message?: string }>;
  };

  if (json.errors?.length) {
    throw new Error(
      json.errors.map((entry) => entry.message).filter(Boolean).join("\n") ||
        "GraphQL query failed"
    );
  }

  const followingConnection = json.data?.account?.following;

  if (!followingConnection) {
    return {
      following: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    };
  }

  const nodes = followingConnection.nodes ?? [];
  const following = nodes
    .map((node) => node.followee)
    .filter((followee): followee is { username?: string | null; profilePic?: string | null; publicKey: string } => Boolean(followee?.publicKey));

  return {
    following,
    pageInfo: {
      hasNextPage: Boolean(followingConnection.pageInfo?.hasNextPage),
      endCursor: followingConnection.pageInfo?.endCursor ?? null,
    },
  };
}

type FetchGroupMessagesInput = {
  accessGroupKeyName: string;
  accessGroupOwnerPublicKey?: string | null;
  limit?: number;
  afterCursor?: string | null;
  beforeCursor?: string | null;
  graphqlEndpoint?: string;
};

export async function fetchGroupMessagesViaGraphql({
  accessGroupKeyName,
  accessGroupOwnerPublicKey,
  limit,
  afterCursor,
  beforeCursor,
  graphqlEndpoint = process.env.EXPO_PUBLIC_DESO_GRAPHQL_URL ??
    DEFAULT_GRAPHQL_URL,
}: FetchGroupMessagesInput): Promise<{
  nodes: GraphqlMessageNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}> {
  const filter: Record<string, unknown> = {
    isGroupChatMessage: { equalTo: true },
    recipientAccessGroupKeyName: { equalTo: accessGroupKeyName },
  };

  if (accessGroupOwnerPublicKey) {
    filter.recipientAccessGroupOwnerPublicKey = {
      equalTo: accessGroupOwnerPublicKey,
    };
  }

  const variables: Record<string, unknown> = {
    filter,
    orderBy: ["TIMESTAMP_DESC"],
  };

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    variables.first = limit;
  }

  if (afterCursor) {
    variables.after = afterCursor;
  }

  if (beforeCursor) {
    variables.before = beforeCursor;
  }

  const body = {
    query: GRAPHQL_QUERY,
    variables,
  };

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchGroupMessagesViaGraphql] request payload", {
      accessGroupKeyName,
      accessGroupOwnerPublicKey,
      variables: body.variables,
    });
  }

  const response = await performGraphqlRequest(body, graphqlEndpoint);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from GraphQL endpoint but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120
      )}…`
    );
  }

  const json = (await response.json()) as {
    data?: {
      messages?: {
        nodes?: GraphqlMessageNode[];
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      } | null;
    } | null;
    errors?: Array<{ message?: string }>;
  };

  if (json.errors?.length) {
    throw new Error(
      json.errors.map((entry) => entry.message).filter(Boolean).join("\n") ||
        "GraphQL query failed"
    );
  }

  const connection = json.data?.messages;
  if (!connection) {
    return {
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    };
  }

  const { nodes = [], pageInfo } = connection;

  return {
    nodes,
    pageInfo: {
      hasNextPage: Boolean(pageInfo?.hasNextPage),
      endCursor:
        typeof pageInfo?.endCursor === "string" ? pageInfo.endCursor : null,
    },
  };
}

export async function fetchAccessGroupMembers({
  accessGroupKeyName,
  accessGroupOwnerPublicKey,
  limit = 50,
  afterCursor,
  graphqlEndpoint = process.env.EXPO_PUBLIC_DESO_GRAPHQL_URL ??
    DEFAULT_GRAPHQL_URL,
}: {
  accessGroupKeyName: string;
  accessGroupOwnerPublicKey: string;
  limit?: number;
  afterCursor?: string | null;
  graphqlEndpoint?: string;
}): Promise<{
  members: GroupMember[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}> {
  const filter: Record<string, unknown> = {
    accessGroupKeyName: { equalTo: accessGroupKeyName },
    accessGroupOwnerPublicKey: { equalTo: accessGroupOwnerPublicKey },
  };

  const variables: Record<string, unknown> = {
    filter,
  };

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    variables.first = 1;
  }

  const body = {
    query: ACCESS_GROUPS_QUERY,
    variables,
  };

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchAccessGroupMembers] request payload", {
      accessGroupKeyName,
      accessGroupOwnerPublicKey,
      variables,
    });
  }

  const response = await performGraphqlRequest(body, graphqlEndpoint);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from GraphQL endpoint but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120
      )}…`
    );
  }

  const json = (await response.json()) as {
    data?: {
      accessGroups?: {
        nodes?: AccessGroupNode[];
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      } | null;
    } | null;
    errors?: Array<{ message?: string }>;  };

  if (json.errors?.length) {
    throw new Error(
      json.errors.map((entry) => entry.message).filter(Boolean).join("\n") ||
        "GraphQL query failed"
    );
  }

  const accessGroupsConnection = json.data?.accessGroups;
  const firstAccessGroup = accessGroupsConnection?.nodes?.[0];
  
  if (!firstAccessGroup?.accessGroupMembers) {
    return {
      members: [],
      pageInfo: { hasNextPage: false, endCursor: null },
    };
  }

  const membersConnection = firstAccessGroup.accessGroupMembers;
  const memberNodes = membersConnection.nodes ?? [];

  const members = memberNodes
    .map((node) => node.member)
    .filter((member): member is GroupMember => Boolean(member?.publicKey));

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchAccessGroupMembers] fetched members", {
      count: members.length,
      members,
    });
  }

  return {
    members,
    pageInfo: {
      hasNextPage: Boolean(membersConnection.pageInfo?.hasNextPage),
      endCursor:
        typeof membersConnection.pageInfo?.endCursor === "string"
          ? membersConnection.pageInfo.endCursor
          : null,
    },
  };
}

export function buildDefaultProfileEntry(
  publicKey: string,
  username?: string | null,
  profilePic?: string | null
): ProfileEntryResponse {
  return {
    PublicKeyBase58Check: publicKey,
    Username: username ?? "",
    Description: "",
    IsHidden: false,
    IsReserved: false,
    IsVerified: false,
    Comments: null,
    Posts: null,
    CoinEntry: null,
    DAOCoinEntry: null,
    CoinPriceDeSoNanos: 0,
    CoinPriceBitCloutNanos: 0,
    DESOBalanceNanos: 0,
    UsersThatHODL: null,
    BestExchangeRateDESOPerDAOCoin: 0,
    IsFeaturedTutorialWellKnownCreator: false,
    IsFeaturedTutorialUpAndComingCreator: false,
    ExtraData: profilePic ? { LargeProfilePicURL: profilePic } : {},
  };
}
