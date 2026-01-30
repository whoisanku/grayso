import { z } from "zod";

const DEFAULT_FOCUS_GRAPHQL_URL = "https://graphql.focus.xyz/graphql";

const ACCOUNT_EXTENDED_BY_PUBLIC_KEY = `
  query AccountExtendedByPublicKey($publicKey: String!) {
    accountByPublicKey(publicKey: $publicKey) {
      ...CoreAccountFields
      description
      profile {
        publicKey
        description
        coinPriceDesoNanos
        __typename
      }
      ...FollowingStats
      subscriptionTiers(filter: { paymentCadenceDays: { notEqualTo: -1 } }) {
        totalCount
        nodes {
          id
          subscriptions {
            totalCount
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }

  fragment AccountModerationFields on Account {
    isBlacklisted
    isGreylisted: userAssociationsAsTarget(
      first: 1
      filter: { associationType: { equalTo: "USER_MODERATION" }, associationValue: { equalTo: "GREYLIST" } }
    ) {
      totalCount
      __typename
    }
    isNSFW: userAssociationsAsTarget(
      first: 1
      filter: { associationType: { equalTo: "USER_MODERATION" }, associationValue: { equalTo: "NSFW" } }
    ) {
      totalCount
      __typename
    }
    isVerifier: userAssociationsAsTarget(
      first: 1
      filter: { associationType: { equalTo: "VERIFIER" }, associationValue: { equalTo: "VERIFIER" } }
    ) {
      totalCount
      __typename
    }
    __typename
  }

  fragment CoreAccountFields on Account {
    id
    publicKey
    username
    extraData
    description
    pkid
    isVerified
    creatorBasisPoints
    totalBalanceUsdCents
    daoCoinMintingDisabled
    daoCoinsInCirculationNanosHex
    isVerified
    subscriptionTiers(filter: { paymentCadenceDays: { notEqualTo: -1 } }) {
      totalCount
      nodes {
        id
        __typename
      }
      __typename
    }
    ...AccountModerationFields
    __typename
  }

  fragment FollowingStats on Account {
    followingCounts {
      totalFollowing
      totalWhaleFollowing
      __typename
    }
    followerCounts {
      totalFollowers
      totalWhaleFollowers
      __typename
    }
    __typename
  }
`;

const ACCOUNT_FOLLOWERS_LIST = `
  query AccountFollowersList($publicKey: String!, $first: Int, $offset: Int, $orderBy: [FollowsOrderBy!] = [NATURAL]) {
    profile(publicKey: $publicKey) {
      publicKey
      account {
        ...FollowingStats
        publicKey
        followers(first: $first, offset: $offset, orderBy: $orderBy) {
          pageInfo {
            hasNextPage
            __typename
          }
          nodes {
            followerPkid
            followedPkid
            follower {
              ...CoreAccountFields
              ...FollowingStats
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
  
  fragment AccountModerationFields on Account {
    isBlacklisted
    isGreylisted: userAssociationsAsTarget(
      first: 1
      filter: { associationType: { equalTo: "USER_MODERATION" }, associationValue: { equalTo: "GREYLIST" } }
    ) {
      totalCount
      __typename
    }
    isNSFW: userAssociationsAsTarget(
      first: 1
      filter: { associationType: { equalTo: "USER_MODERATION" }, associationValue: { equalTo: "NSFW" } }
    ) {
      totalCount
      __typename
    }
    isVerifier: userAssociationsAsTarget(
      first: 1
      filter: { associationType: { equalTo: "VERIFIER" }, associationValue: { equalTo: "VERIFIER" } }
    ) {
      totalCount
      __typename
    }
    __typename
  }
  
  fragment FollowingStats on Account {
    followingCounts {
      totalFollowing
      totalWhaleFollowing
      __typename
    }
    followerCounts {
      totalFollowers
      totalWhaleFollowers
      __typename
    }
    __typename
  }
  
  fragment CoreAccountFields on Account {
    id
    publicKey
    username
    extraData
    description
    pkid
    isVerified
    creatorBasisPoints
    totalBalanceUsdCents
    daoCoinMintingDisabled
    daoCoinsInCirculationNanosHex
    isVerified
    subscriptionTiers(filter: { paymentCadenceDays: { notEqualTo: -1 } }) {
      totalCount
      nodes {
        id
        __typename
      }
      __typename
    }
    ...AccountModerationFields
    __typename
  }
`;

const ACCOUNT_FOLLOWING_LIST = `
  query AccountFollowingList($publicKey: String!, $first: Int, $offset: Int, $orderBy: [FollowsOrderBy!] = [NATURAL]) {
    profile(publicKey: $publicKey) {
      publicKey
      account {
        ...FollowingStats
        publicKey
        following(first: $first, offset: $offset, orderBy: $orderBy) {
          pageInfo {
            hasNextPage
            __typename
          }
          nodes {
            followerPkid
            followedPkid
            followee {
              ...CoreAccountFields
              ...FollowingStats
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
  
  fragment AccountModerationFields on Account {
    isBlacklisted
    isGreylisted: userAssociationsAsTarget(
      first: 1
      filter: { associationType: { equalTo: "USER_MODERATION" }, associationValue: { equalTo: "GREYLIST" } }
    ) {
      totalCount
      __typename
    }
    isNSFW: userAssociationsAsTarget(
      first: 1
      filter: { associationType: { equalTo: "USER_MODERATION" }, associationValue: { equalTo: "NSFW" } }
    ) {
      totalCount
      __typename
    }
    isVerifier: userAssociationsAsTarget(
      first: 1
      filter: { associationType: { equalTo: "VERIFIER" }, associationValue: { equalTo: "VERIFIER" } }
    ) {
      totalCount
      __typename
    }
    __typename
  }
  
  fragment FollowingStats on Account {
    followingCounts {
      totalFollowing
      totalWhaleFollowing
      __typename
    }
    followerCounts {
      totalFollowers
      totalWhaleFollowers
      __typename
    }
    __typename
  }
  
  fragment CoreAccountFields on Account {
    id
    publicKey
    username
    extraData
    description
    pkid
    isVerified
    creatorBasisPoints
    totalBalanceUsdCents
    daoCoinMintingDisabled
    daoCoinsInCirculationNanosHex
    isVerified
    subscriptionTiers(filter: { paymentCadenceDays: { notEqualTo: -1 } }) {
      totalCount
      nodes {
        id
        __typename
      }
      __typename
    }
    ...AccountModerationFields
    __typename
  }
`;

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
              isGroupChatMessage
              threadIdentifier
              extraData
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

const numberLike = z.union([z.number(), z.string()]).transform((value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
});

const focusAccountSchema = z.object({
  id: z.string(),
  publicKey: z.string(),
  username: z.string().nullish(),
  description: z.string().nullish(),
  extraData: z.record(z.string(), z.unknown()).nullish(),
  pkid: z.string().nullish(),
  isVerified: z.boolean().nullish(),
  creatorBasisPoints: z.string().nullish(),
  totalBalanceUsdCents: numberLike.nullish(),
  daoCoinMintingDisabled: z.boolean().nullish(),
  daoCoinsInCirculationNanosHex: z.string().nullish(),
  subscriptionTiers: z
    .object({
      totalCount: numberLike,
    })
    .nullish(),
  profile: z
    .object({
      publicKey: z.string(),
      description: z.string().nullish(),
      coinPriceDesoNanos: z.string().nullish(),
    })
    .nullish(),
  followingCounts: z
    .object({
      totalFollowing: numberLike,
      totalWhaleFollowing: numberLike.nullish(),
    })
    .nullish(),
  followerCounts: z
    .object({
      totalFollowers: numberLike,
      totalWhaleFollowers: numberLike.nullish(),
    })
    .nullish(),
});

const followPageInfoSchema = z
  .object({
    hasNextPage: z.boolean().nullish(),
  })
  .passthrough()
  .nullish();

const followNodeSchema = z
  .object({
    followerPkid: z.string().nullish(),
    followedPkid: z.string().nullish(),
    follower: focusAccountSchema.nullish(),
    followee: focusAccountSchema.nullish(),
  })
  .passthrough();

const followConnectionSchema = z
  .object({
    pageInfo: followPageInfoSchema,
    nodes: z.array(followNodeSchema).default([]),
  })
  .passthrough()
  .nullish();

const followersResponseSchema = z.object({
  data: z.object({
    profile: z
      .object({
        publicKey: z.string(),
        account: z
          .object({
            publicKey: z.string().optional(),
            followers: followConnectionSchema,
            following: followConnectionSchema,
          })
          .nullish(),
      })
      .nullish(),
  }),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

const accountExtendedResponseSchema = z.object({
  data: z.object({
    accountByPublicKey: focusAccountSchema.nullish(),
  }),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

export type FocusAccount = z.infer<typeof focusAccountSchema>;
export type FocusFollowEdge = z.infer<typeof followNodeSchema>;

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

export async function fetchAccountExtendedByPublicKey({
  publicKey,
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
    DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  publicKey: string;
  graphqlEndpoint?: string;
}): Promise<FocusAccount | null> {
  const body = {
    operationName: "AccountExtendedByPublicKey",
    query: ACCOUNT_EXTENDED_BY_PUBLIC_KEY,
    variables: { publicKey },
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

  const json = await response.json();

  const parsed = accountExtendedResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse profile response"
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Profile query returned errors"
    );
  }

  return parsed.data.data.accountByPublicKey ?? null;
}

type FollowListResult = {
  accounts: FocusAccount[];
  pageInfo: { hasNextPage?: boolean | null };
};

export async function fetchFollowersList({
  publicKey,
  first = 10,
  offset = 0,
  orderBy = ["FOLLOWER_DESO_BALANCE_USD_CENTS_DESC"],
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ?? DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  publicKey: string;
  first?: number;
  offset?: number;
  orderBy?: string[];
  graphqlEndpoint?: string;
}): Promise<FollowListResult> {
  const body = {
    operationName: "AccountFollowersList",
    query: ACCOUNT_FOLLOWERS_LIST,
    variables: { publicKey, first, offset, orderBy },
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

  const json = await response.json();
  const parsed = followersResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse followers response"
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Followers query returned errors"
    );
  }

  const nodes = parsed.data.data.profile?.account?.followers?.nodes ?? [];
  const pageInfo = parsed.data.data.profile?.account?.followers?.pageInfo ?? {};

  return {
    accounts: nodes
      .map((node) => node?.follower)
      .filter((acct): acct is FocusAccount => Boolean(acct)),
    pageInfo,
  };
}

export async function fetchFollowingList({
  publicKey,
  first = 10,
  offset = 0,
  orderBy = ["FOLLOWER_DESO_BALANCE_USD_CENTS_DESC"],
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ?? DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  publicKey: string;
  first?: number;
  offset?: number;
  orderBy?: string[];
  graphqlEndpoint?: string;
}): Promise<FollowListResult> {
  const body = {
    operationName: "AccountFollowingList",
    query: ACCOUNT_FOLLOWING_LIST,
    variables: { publicKey, first, offset, orderBy },
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

  const json = await response.json();
  const parsed = followersResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse following response"
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Following query returned errors"
    );
  }

  const nodes = parsed.data.data.profile?.account?.following?.nodes ?? [];
  const pageInfo = parsed.data.data.profile?.account?.following?.pageInfo ?? {};

  return {
    accounts: nodes
      .map((node) => node?.followee)
      .filter((acct): acct is FocusAccount => Boolean(acct)),
    pageInfo,
  };
}

export async function fetchInboxMessageThreads({
  userPublicKey,
  first = 20,
  offset = 0,
  orderBy = ["LATEST_MESSAGE_TIMESTAMP_DESC"],
  isSpam,
  filter,
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
  DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  userPublicKey: string;
  first?: number;
  offset?: number;
  orderBy?: string[];
  isSpam?: boolean | null;
  filter?: Record<string, unknown>;
  graphqlEndpoint?: string;
}): Promise<{
  nodes: FocusThreadNode[];
  pageInfo: FocusPageInfo;
}> {
  const mergedFilter = {
    initiator: { isBlacklisted: { equalTo: false } },
    ...filter,
    ...(typeof isSpam === "boolean"
      ? {
          // Explicit isSpam param takes precedence over caller-provided filter
          isSpam: { equalTo: isSpam },
        }
      : {}),
  } as Record<string, unknown>;

  const variables: Record<string, unknown> = {
    userPublicKey,
    first,
    offset,
    orderBy,
    filter: mergedFilter,
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
