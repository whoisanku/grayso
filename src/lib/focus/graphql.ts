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

const FOLLOW_FEEDS_HASHES_QUERY = `
  query FollowFeedsHashes(
    $filter: FollowFeedFilter
    $first: Int
    $offset: Int
    $orderBy: [FollowFeedsOrderBy!]
  ) {
    followFeeds(
      filter: $filter
      first: $first
      offset: $offset
      orderBy: $orderBy
    ) {
      nodes {
        id
        postHash
        __typename
      }
      pageInfo {
        endCursor
        hasNextPage
        __typename
      }
      __typename
    }
  }
`;

const FOR_YOU_FEED_HASHES_QUERY = `
  query ForYouFeedHashes(
    $filter: FeedWeightedPostScoreFilter
    $first: Int
    $offset: Int
    $orderBy: [FeedWeightedPostScoresOrderBy!]
  ) {
    feedWeightedPostScores(
      filter: $filter
      first: $first
      offset: $offset
      orderBy: $orderBy
    ) {
      nodes {
        postHash
      }
      pageInfo {
        endCursor
        hasNextPage
        __typename
      }
      __typename
    }
  }
`;

const POST_BY_POST_HASH_QUERY = `
  query PostByPostHash($postHash: String!, $readerPublicKey: String!) {
    postByPostHash(postHash: $postHash) {
      body
      postHash
      parentPostHash
      rootPostHash
      commentDepth
      repostedPostHash
      repostedPost {
        body
        postHash
        imageUrls
        videoUrls
        timestamp
        poster {
          publicKey
          username
          extraData
          isVerified
          __typename
        }
        __typename
      }
      extraData
      imageUrls
      videoUrls
      timestamp
      isNft
      isQuotedRepost
      isHidden
      poster {
        publicKey
        username
        extraData
        isVerified
        __typename
      }
      postStats {
        totalReactionCount
        likeReactionCount
        laughReactionCount
        loveReactionCount
        dislikeReactionCount
        angryReactionCount
        astonishedReactionCount
        replyCount
        quoteCount
        repostCount
        __typename
      }
      reactionAssociations: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
      ) {
        totalCount
      }
      likeReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "LIKE" } }
      ) {
        totalCount
      }
      dislikeReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "DISLIKE" } }
      ) {
        totalCount
      }
      loveReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "LOVE" } }
      ) {
        totalCount
      }
      laughReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "LAUGH" } }
      ) {
        totalCount
      }
      sadReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "SAD" } }
      ) {
        totalCount
      }
      cryReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "CRY" } }
      ) {
        totalCount
      }
      angryReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "ANGRY" } }
      ) {
        totalCount
      }
      viewerReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { transactorPkid: { equalTo: $readerPublicKey } }
        first: 10
      ) {
        nodes {
          associationId
          associationType
          associationValue
        }
      }
      __typename
    }
  }
`;

const POST_THREAD_PAGE_BY_POST_HASH_QUERY = `
  query PostThreadPageByPostHash(
    $postHash: String!
    $readerPublicKey: String!
    $first: Int
    $offset: Int
    $orderBy: [PostsOrderBy!]
  ) {
    postByPostHash(postHash: $postHash) {
      body
      postHash
      parentPostHash
      rootPostHash
      commentDepth
      repostedPostHash
      repostedPost {
        body
        postHash
        imageUrls
        videoUrls
        timestamp
        poster {
          publicKey
          username
          extraData
          isVerified
          __typename
        }
        __typename
      }
      extraData
      imageUrls
      videoUrls
      timestamp
      isNft
      isQuotedRepost
      isHidden
      poster {
        publicKey
        username
        extraData
        isVerified
        __typename
      }
      postStats {
        totalReactionCount
        likeReactionCount
        laughReactionCount
        loveReactionCount
        dislikeReactionCount
        angryReactionCount
        astonishedReactionCount
        replyCount
        quoteCount
        repostCount
        __typename
      }
      reactionAssociations: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
      ) {
        totalCount
      }
      likeReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "LIKE" } }
      ) {
        totalCount
      }
      dislikeReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "DISLIKE" } }
      ) {
        totalCount
      }
      loveReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "LOVE" } }
      ) {
        totalCount
      }
      laughReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "LAUGH" } }
      ) {
        totalCount
      }
      sadReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "SAD" } }
      ) {
        totalCount
      }
      cryReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "CRY" } }
      ) {
        totalCount
      }
      angryReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { associationValue: { equalTo: "ANGRY" } }
      ) {
        totalCount
      }
      viewerReactions: postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: { transactorPkid: { equalTo: $readerPublicKey } }
        first: 10
      ) {
        nodes {
          associationId
          associationType
          associationValue
        }
      }
      replies(first: $first, offset: $offset, orderBy: $orderBy) {
        totalCount
        pageInfo {
          hasNextPage
          __typename
        }
        nodes {
          body
          postHash
          parentPostHash
          rootPostHash
          commentDepth
          repostedPostHash
          repostedPost {
            body
            postHash
            imageUrls
            videoUrls
            timestamp
            poster {
              publicKey
              username
              extraData
              isVerified
              __typename
            }
            __typename
          }
          extraData
          imageUrls
          videoUrls
          timestamp
          isNft
          isQuotedRepost
          isHidden
          poster {
            publicKey
            username
            extraData
            isVerified
            __typename
          }
          postStats {
            totalReactionCount
            likeReactionCount
            laughReactionCount
            loveReactionCount
            dislikeReactionCount
            angryReactionCount
            astonishedReactionCount
            replyCount
            quoteCount
            repostCount
            __typename
          }
          reactionAssociations: postAssociationsByPostHash(
            condition: { associationType: "REACTION" }
          ) {
            totalCount
          }
          likeReactions: postAssociationsByPostHash(
            condition: { associationType: "REACTION" }
            filter: { associationValue: { equalTo: "LIKE" } }
          ) {
            totalCount
          }
          dislikeReactions: postAssociationsByPostHash(
            condition: { associationType: "REACTION" }
            filter: { associationValue: { equalTo: "DISLIKE" } }
          ) {
            totalCount
          }
          loveReactions: postAssociationsByPostHash(
            condition: { associationType: "REACTION" }
            filter: { associationValue: { equalTo: "LOVE" } }
          ) {
            totalCount
          }
          laughReactions: postAssociationsByPostHash(
            condition: { associationType: "REACTION" }
            filter: { associationValue: { equalTo: "LAUGH" } }
          ) {
            totalCount
          }
          sadReactions: postAssociationsByPostHash(
            condition: { associationType: "REACTION" }
            filter: { associationValue: { equalTo: "SAD" } }
          ) {
            totalCount
          }
          cryReactions: postAssociationsByPostHash(
            condition: { associationType: "REACTION" }
            filter: { associationValue: { equalTo: "CRY" } }
          ) {
            totalCount
          }
          angryReactions: postAssociationsByPostHash(
            condition: { associationType: "REACTION" }
            filter: { associationValue: { equalTo: "ANGRY" } }
          ) {
            totalCount
          }
          viewerReactions: postAssociationsByPostHash(
            condition: { associationType: "REACTION" }
            filter: { transactorPkid: { equalTo: $readerPublicKey } }
            first: 10
          ) {
            nodes {
              associationId
              associationType
              associationValue
            }
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const POST_BY_POST_HASH_REACTION_LIST_QUERY = `
  query PostByPostHashReactionList(
    $postHash: String!
    $filter: PostAssociationFilter
    $first: Int
    $offset: Int
    $orderBy: [PostAssociationsOrderBy!]
  ) {
    postByPostHash(postHash: $postHash) {
      postHash
      postAssociationsByPostHash(
        condition: { associationType: "REACTION" }
        filter: $filter
        first: $first
        offset: $offset
        orderBy: $orderBy
      ) {
        totalCount
        nodes {
          associationId
          associationValue
          associationType
          transactor {
            ...CoreAccountFields
            ...FollowingStats
            __typename
          }
          __typename
        }
        __typename
      }
      likes {
        totalCount
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
  errors?: { message?: string }[] | null;
};

type FocusFeedPageInfo = {
  endCursor?: string | null;
  hasNextPage?: boolean | null;
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

const followFeedHashNodeSchema = z.object({
  id: z.string().nullish(),
  postHash: z.string(),
});

const followFeedsHashesResponseSchema = z.object({
  data: z.object({
    followFeeds: z
      .object({
        nodes: z.array(followFeedHashNodeSchema).default([]),
        pageInfo: z
          .object({
            endCursor: z.string().nullish(),
            hasNextPage: z.boolean().nullish(),
          })
          .nullish(),
      })
      .nullish(),
  }),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

const feedPosterSchema = z.object({
  publicKey: z.string(),
  username: z.string().nullish(),
  extraData: z.record(z.string(), z.unknown()).nullish(),
  isVerified: z.boolean().nullish(),
});

const feedRepostedPostSchema = z.object({
  body: z.string().nullish(),
  postHash: z.string(),
  imageUrls: z.array(z.string()).nullish(),
  videoUrls: z.array(z.string()).nullish(),
  timestamp: z.string().nullish(),
  poster: feedPosterSchema.nullish(),
});

const reactionCountConnectionSchema = z.object({
  totalCount: numberLike.nullish(),
});

const viewerReactionNodeSchema = z.object({
  associationId: z.string().nullish(),
  associationType: z.string().nullish(),
  associationValue: z.string().nullish(),
});

const viewerReactionsConnectionSchema = z.object({
  nodes: z.array(viewerReactionNodeSchema).default([]),
});

const feedPostSchema = z.object({
  body: z.string().nullish(),
  postHash: z.string(),
  parentPostHash: z.string().nullish(),
  rootPostHash: z.string().nullish(),
  commentDepth: numberLike.nullish(),
  repostedPostHash: z.string().nullish(),
  repostedPost: feedRepostedPostSchema.nullish(),
  extraData: z.record(z.string(), z.unknown()).nullish(),
  imageUrls: z.array(z.string()).nullish(),
  videoUrls: z.array(z.string()).nullish(),
  timestamp: z.string().nullish(),
  isNft: z.boolean().nullish(),
  isQuotedRepost: z.boolean().nullish(),
  isHidden: z.boolean().nullish(),
  poster: feedPosterSchema.nullish(),
  postStats: z
    .object({
      totalReactionCount: numberLike.nullish(),
      likeReactionCount: numberLike.nullish(),
      laughReactionCount: numberLike.nullish(),
      loveReactionCount: numberLike.nullish(),
      dislikeReactionCount: numberLike.nullish(),
      angryReactionCount: numberLike.nullish(),
      astonishedReactionCount: numberLike.nullish(),
      replyCount: numberLike.nullish(),
      quoteCount: numberLike.nullish(),
      repostCount: numberLike.nullish(),
    })
    .nullish(),
  reactionAssociations: reactionCountConnectionSchema.nullish(),
  likeReactions: reactionCountConnectionSchema.nullish(),
  dislikeReactions: reactionCountConnectionSchema.nullish(),
  loveReactions: reactionCountConnectionSchema.nullish(),
  laughReactions: reactionCountConnectionSchema.nullish(),
  sadReactions: reactionCountConnectionSchema.nullish(),
  cryReactions: reactionCountConnectionSchema.nullish(),
  angryReactions: reactionCountConnectionSchema.nullish(),
  viewerReactions: viewerReactionsConnectionSchema.nullish(),
});

const forYouFeedHashNodeSchema = z.object({
  postHash: z.string(),
});

const forYouFeedHashesResponseSchema = z.object({
  data: z.object({
    feedWeightedPostScores: z
      .object({
        nodes: z.array(forYouFeedHashNodeSchema).default([]),
        pageInfo: z
          .object({
            endCursor: z.string().nullish(),
            hasNextPage: z.boolean().nullish(),
          })
          .nullish(),
      })
      .nullish(),
  }),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

const postByHashResponseSchema = z.object({
  data: z.object({
    postByPostHash: feedPostSchema.nullish(),
  }),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

const postsPageInfoSchema = z
  .object({
    hasNextPage: z.boolean().nullish(),
  })
  .passthrough()
  .nullish();

const postsConnectionSchema = z.object({
  totalCount: numberLike.nullish(),
  pageInfo: postsPageInfoSchema,
  nodes: z.array(feedPostSchema).default([]),
});

const postThreadPageResponseSchema = z.object({
  data: z.object({
    postByPostHash: feedPostSchema
      .extend({
        replies: postsConnectionSchema.nullish(),
      })
      .nullish(),
  }),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

const postReactionModerationStateSchema = z.object({
  totalCount: numberLike.nullish(),
});

const postReactionTransactorSchema = z
  .object({
    id: z.string().nullish(),
    publicKey: z.string().nullish(),
    username: z.string().nullish(),
    extraData: z.record(z.string(), z.unknown()).nullish(),
    description: z.string().nullish(),
    pkid: z.string().nullish(),
    isVerified: z.boolean().nullish(),
    creatorBasisPoints: z.union([z.number(), z.string()]).nullish(),
    totalBalanceUsdCents: numberLike.nullish(),
    daoCoinMintingDisabled: z.boolean().nullish(),
    daoCoinsInCirculationNanosHex: z.string().nullish(),
    subscriptionTiers: z
      .object({
        totalCount: numberLike.nullish(),
        nodes: z
          .array(
            z
              .object({
                id: z.string().nullish(),
              })
              .passthrough(),
          )
          .default([]),
      })
      .nullish(),
    isBlacklisted: z.boolean().nullish(),
    isGreylisted: postReactionModerationStateSchema.nullish(),
    isNSFW: postReactionModerationStateSchema.nullish(),
    isVerifier: postReactionModerationStateSchema.nullish(),
    followingCounts: z
      .object({
        totalFollowing: numberLike.nullish(),
        totalWhaleFollowing: numberLike.nullish(),
      })
      .nullish(),
    followerCounts: z
      .object({
        totalFollowers: numberLike.nullish(),
        totalWhaleFollowers: numberLike.nullish(),
      })
      .nullish(),
  })
  .passthrough();

const postReactionAssociationNodeSchema = z
  .object({
    associationId: z.string().nullish(),
    associationValue: z.string().nullish(),
    associationType: z.string().nullish(),
    transactor: postReactionTransactorSchema.nullish(),
  })
  .passthrough();

const postReactionAssociationsConnectionSchema = z.object({
  totalCount: numberLike.nullish(),
  nodes: z.array(postReactionAssociationNodeSchema).default([]),
});

const postByHashReactionListResponseSchema = z.object({
  data: z.object({
    postByPostHash: z
      .object({
        postHash: z.string().nullish(),
        postAssociationsByPostHash:
          postReactionAssociationsConnectionSchema.nullish(),
        likes: z
          .object({
            totalCount: numberLike.nullish(),
          })
          .nullish(),
      })
      .nullish(),
  }),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

export type FocusAccount = z.infer<typeof focusAccountSchema>;
export type FocusFollowEdge = z.infer<typeof followNodeSchema>;
export type FocusFollowFeedHashNode = z.infer<typeof followFeedHashNodeSchema>;
export type FocusForYouFeedHashNode = z.infer<typeof forYouFeedHashNodeSchema>;
export type FocusFeedPost = z.infer<typeof feedPostSchema>;
export type FocusPostReactionAssociationNode = z.infer<
  typeof postReactionAssociationNodeSchema
>;
export type FocusPostThreadPageResult = {
  post: FocusFeedPost | null;
  replies: FocusFeedPost[];
  totalCount: number;
  nextOffset: number | null;
  hasNextPage: boolean;
};

export type FocusPostReactionListResult = {
  totalCount: number;
  likesCount: number;
  nodes: FocusPostReactionAssociationNode[];
  nextOffset: number | null;
};

async function performGraphqlRequest(
  body: Record<string, unknown>,
  graphqlEndpoint: string,
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
        120,
      )}`,
    );
  }

  const json = await response.json();

  const parsed = accountExtendedResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse profile response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Profile query returned errors",
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
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
    DEFAULT_FOCUS_GRAPHQL_URL,
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
        120,
      )}`,
    );
  }

  const json = await response.json();
  const parsed = followersResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse followers response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Followers query returned errors",
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
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
    DEFAULT_FOCUS_GRAPHQL_URL,
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
        120,
      )}`,
    );
  }

  const json = await response.json();
  const parsed = followersResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse following response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Following query returned errors",
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

export async function fetchFollowFeedHashes({
  followerPublicKey,
  first = 20,
  offset = 0,
  orderBy = ["TIMESTAMP_DESC"],
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
    DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  followerPublicKey: string;
  first?: number;
  offset?: number;
  orderBy?: string[];
  graphqlEndpoint?: string;
}): Promise<{
  nodes: FocusFollowFeedHashNode[];
  pageInfo: FocusFeedPageInfo;
  nextOffset: number | null;
}> {
  const body = {
    operationName: "FollowFeedsHashes",
    query: FOLLOW_FEEDS_HASHES_QUERY,
    variables: {
      first,
      offset,
      orderBy,
      filter: {
        followerPublicKey: { equalTo: followerPublicKey },
      },
    },
  };

  const response = await performGraphqlRequest(body, graphqlEndpoint);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from GraphQL endpoint but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120,
      )}`,
    );
  }

  const json = await response.json();
  const parsed = followFeedsHashesResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse follow feed hashes response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Follow feed hashes query returned errors",
    );
  }

  const nodes = parsed.data.data.followFeeds?.nodes ?? [];
  const pageInfo = parsed.data.data.followFeeds?.pageInfo ?? {};
  const hasNextPage = Boolean(pageInfo?.hasNextPage);
  const nextOffset = hasNextPage ? offset + nodes.length : null;

  return {
    nodes,
    pageInfo,
    nextOffset,
  };
}

export async function fetchForYouFeedHashes({
  first = 20,
  offset = 0,
  orderBy = ["WEIGHTED_SCORE_WITH_WEALTH_DESC"],
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
    DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  first?: number;
  offset?: number;
  orderBy?: string[];
  graphqlEndpoint?: string;
}): Promise<{
  nodes: FocusForYouFeedHashNode[];
  pageInfo: FocusFeedPageInfo;
  nextOffset: number | null;
}> {
  const body = {
    operationName: "ForYouFeedHashes",
    query: FOR_YOU_FEED_HASHES_QUERY,
    variables: {
      first,
      offset,
      orderBy,
      filter: {
        isComment: { equalTo: false },
        isHidden: { equalTo: false },
        isHiddenByMod: { equalTo: false },
      },
    },
  };

  const response = await performGraphqlRequest(body, graphqlEndpoint);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from GraphQL endpoint but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120,
      )}`,
    );
  }

  const json = await response.json();
  const parsed = forYouFeedHashesResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse for you feed hashes response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "For you feed hashes query returned errors",
    );
  }

  const nodes = parsed.data.data.feedWeightedPostScores?.nodes ?? [];
  const pageInfo = parsed.data.data.feedWeightedPostScores?.pageInfo ?? {};
  const hasNextPage = Boolean(pageInfo?.hasNextPage);
  const nextOffset = hasNextPage ? offset + nodes.length : null;

  return {
    nodes,
    pageInfo,
    nextOffset,
  };
}

export async function fetchPostByPostHash({
  postHash,
  readerPublicKey = "",
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
    DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  postHash: string;
  readerPublicKey?: string;
  graphqlEndpoint?: string;
}): Promise<FocusFeedPost | null> {
  const body = {
    operationName: "PostByPostHash",
    query: POST_BY_POST_HASH_QUERY,
    variables: {
      postHash,
      readerPublicKey,
    },
  };

  const response = await performGraphqlRequest(body, graphqlEndpoint);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from GraphQL endpoint but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120,
      )}`,
    );
  }

  const json = await response.json();
  const parsed = postByHashResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse post by hash response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Post by hash query returned errors",
    );
  }

  return parsed.data.data.postByPostHash ?? null;
}

export async function fetchPostThreadPageByPostHash({
  postHash,
  readerPublicKey = "",
  first = 8,
  offset = 0,
  orderBy = ["TIMESTAMP_ASC"],
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
    DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  postHash: string;
  readerPublicKey?: string;
  first?: number;
  offset?: number;
  orderBy?: string[];
  graphqlEndpoint?: string;
}): Promise<FocusPostThreadPageResult> {
  const body = {
    operationName: "PostThreadPageByPostHash",
    query: POST_THREAD_PAGE_BY_POST_HASH_QUERY,
    variables: {
      postHash,
      readerPublicKey,
      first,
      offset,
      orderBy,
    },
  };

  const response = await performGraphqlRequest(body, graphqlEndpoint);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from GraphQL endpoint but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120,
      )}`,
    );
  }

  const json = await response.json();
  const parsed = postThreadPageResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse post thread response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Post thread query returned errors",
    );
  }

  const post = parsed.data.data.postByPostHash ?? null;
  const repliesConnection = post?.replies ?? null;
  const replies = repliesConnection?.nodes ?? [];
  const totalCount = Number(repliesConnection?.totalCount ?? replies.length);
  const safeTotalCount = Number.isFinite(totalCount)
    ? Math.max(0, Math.floor(totalCount))
    : replies.length;
  const hasNextPage = Boolean(repliesConnection?.pageInfo?.hasNextPage);
  const nextOffset = hasNextPage ? offset + replies.length : null;

  return {
    post,
    replies,
    totalCount: safeTotalCount,
    nextOffset,
    hasNextPage,
  };
}

export async function fetchPostByPostHashReactionList({
  postHash,
  first = 40,
  offset = 0,
  orderBy = ["TRANSACTOR_TOTAL_BALANCE_USD_CENTS_DESC"],
  reactionValue,
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
    DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  postHash: string;
  first?: number;
  offset?: number;
  orderBy?: string[];
  reactionValue?: string | null;
  graphqlEndpoint?: string;
}): Promise<FocusPostReactionListResult> {
  const body = {
    operationName: "PostByPostHashReactionList",
    query: POST_BY_POST_HASH_REACTION_LIST_QUERY,
    variables: {
      postHash,
      first,
      offset,
      orderBy,
      filter: reactionValue
        ? {
            associationValue: {
              equalTo: reactionValue,
            },
          }
        : null,
    },
  };

  const response = await performGraphqlRequest(body, graphqlEndpoint);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from GraphQL endpoint but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120,
      )}`,
    );
  }

  const json = await response.json();
  const parsed = postByHashReactionListResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse post reactions response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Post reactions query returned errors",
    );
  }

  const post = parsed.data.data.postByPostHash;
  const reactionConnection = post?.postAssociationsByPostHash;
  const nodes = reactionConnection?.nodes ?? [];

  const parsedTotalCount = Number(reactionConnection?.totalCount ?? nodes.length);
  const totalCount = Number.isFinite(parsedTotalCount)
    ? Math.max(0, Math.floor(parsedTotalCount))
    : nodes.length;

  const parsedLikesCount = Number(post?.likes?.totalCount ?? 0);
  const likesCount = Number.isFinite(parsedLikesCount)
    ? Math.max(0, Math.floor(parsedLikesCount))
    : 0;

  const nextOffset = totalCount > offset + nodes.length ? offset + nodes.length : null;

  return {
    totalCount,
    likesCount,
    nodes,
    nextOffset,
  };
}

// Backward-compatible alias while callers are migrated.
export const fetchPostByPostHashCached = fetchPostByPostHash;

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
        120,
      )}`,
    );
  }

  const json = (await response.json()) as FocusInboxResponse;

  if (json.errors?.length) {
    throw new Error(
      json.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "GraphQL query returned errors",
    );
  }

  const nodes = json.data?.filterableMessageThreads?.nodes ?? [];
  const pageInfo = json.data?.filterableMessageThreads?.pageInfo ?? {};

  return {
    nodes: Array.isArray(nodes) ? nodes : [],
    pageInfo,
  };
}
