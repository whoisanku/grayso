import type { ProfileEntryResponse } from "deso-protocol";

const DEFAULT_GRAPHQL_URL = "https://graphql-prod.deso.com/graphql";

const GRAPHQL_QUERY = `
  query Messages($filter: MessageFilter, $orderBy: [MessagesOrderBy!]) {
    messages(filter: $filter, orderBy: $orderBy) {
      nodes {
        id
        encryptedText
        timestamp
        senderAccessGroupOwnerPublicKey
        recipientAccessGroupOwnerPublicKey
        senderAccessGroupPublicKey
        recipientAccessGroupPublicKey
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
        }
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
  } | null;
  isGroupChatMessage?: boolean | null;
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
    } | null;
  } | null;
  errors?: { message?: string }[];
};

type FetchDmMessagesInput = {
  userPublicKey: string;
  counterPartyPublicKey: string;
  limit: number;
  isGroupChat?: boolean;
  beforeTimestampNanos?: number;
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
  beforeTimestampNanos,
  graphqlEndpoint = process.env.EXPO_PUBLIC_DESO_GRAPHQL_URL ??
    DEFAULT_GRAPHQL_URL,
}: FetchDmMessagesInput): Promise<GraphqlMessageNode[]> {
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

  if (beforeTimestampNanos && Number.isSafeInteger(beforeTimestampNanos)) {
    // Ensure timestamp is properly formatted as a string for GraphQL
    const timestampStr = beforeTimestampNanos.toString();
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.log("[fetchDmMessagesViaGraphql] Using timestamp filter", {
        original: beforeTimestampNanos,
        asString: timestampStr,
        length: timestampStr.length,
      });
    }
    filter.timestamp = { lessThan: timestampStr };
  }

  const body = {
    query: GRAPHQL_QUERY,
    variables: {
      filter,
      orderBy: ["TIMESTAMP_DESC"],
    },
  };

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchDmMessagesViaGraphql] request payload", {
      userPublicKey,
      counterPartyPublicKey,
      beforeTimestampNanos,
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

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[fetchDmMessagesViaGraphql] messages nodes", {
      count: Array.isArray(nodes) ? nodes.length : 0,
      firstNode: Array.isArray(nodes) ? nodes[0] : null,
    });
  }
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.slice(0, limit);
}

export function buildDefaultProfileEntry(
  publicKey: string,
  username?: string | null
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
    ExtraData: {},
  };
}
