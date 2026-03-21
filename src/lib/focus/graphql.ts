import { identity } from "deso-protocol";
import { z } from "zod";

const DEFAULT_FOCUS_GRAPHQL_URL = "https://graphql.focus.xyz/graphql";
const DEFAULT_FOCUS_API_V0_URL = "https://focus.xyz/api/v0";

const ACCOUNT_EXTENDED_BY_PUBLIC_KEY = `
  query AccountExtendedByPublicKey($publicKey: String!) {
    accountByPublicKey(publicKey: $publicKey) {
      ...CoreAccountFields
      description
      accountWealth {
        publicKey
        usdBalanceUsdCents
        focusTokenBalanceUsdCents
        desoBalanceUsdCents
        desoBalanceNanos
        focusTokenBalanceBaseUnits
        focusTokenLockedBalanceUsdCents
        focusTokenLockedBalanceBaseUnits
        focusTokenTotalBalanceBaseUnits
        usdBalanceBaseUnits
        totalBalanceUsdCents
        __typename
      }
      accountWealthChainUser {
        publicKey
        usdBalanceUsdCents
        focusTokenBalanceUsdCents
        desoBalanceUsdCents
        desoBalanceNanos
        focusTokenBalanceBaseUnits
        focusTokenLockedBalanceUsdCents
        focusTokenLockedBalanceBaseUnits
        focusTokenTotalBalanceBaseUnits
        usdBalanceBaseUnits
        totalBalanceUsdCents
        __typename
      }
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

const ACCOUNT_EXTENDED_BY_USERNAME = `
  query AccountExtendedByUsername($username: String!) {
    accountByUsername(username: $username) {
      ...CoreAccountFields
      description
      accountWealth {
        publicKey
        usdBalanceUsdCents
        focusTokenBalanceUsdCents
        desoBalanceUsdCents
        desoBalanceNanos
        focusTokenBalanceBaseUnits
        focusTokenLockedBalanceUsdCents
        focusTokenLockedBalanceBaseUnits
        focusTokenTotalBalanceBaseUnits
        usdBalanceBaseUnits
        totalBalanceUsdCents
        __typename
      }
      accountWealthChainUser {
        publicKey
        usdBalanceUsdCents
        focusTokenBalanceUsdCents
        desoBalanceUsdCents
        desoBalanceNanos
        focusTokenBalanceBaseUnits
        focusTokenLockedBalanceUsdCents
        focusTokenLockedBalanceBaseUnits
        focusTokenTotalBalanceBaseUnits
        usdBalanceBaseUnits
        totalBalanceUsdCents
        __typename
      }
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

const USER_SEARCH_QUERY = `
  query UserSearch($includeAccounts: Boolean!, $accountsFilter: AccountFilter, $first: Int, $orderBy: [AccountsOrderBy!]) {
    accounts(filter: $accountsFilter, first: $first, orderBy: $orderBy) @include(if: $includeAccounts) {
      nodes {
        publicKey
        username
        extraData
        __typename
      }
      __typename
    }
  }
`;

const POST_REPLIES_PAGE_BY_POST_HASH_QUERY = `
  query PostRepliesPageByPostHash(
    $postHash: String!
    $readerPublicKey: String!
    $first: Int
    $offset: Int
    $orderBy: [PostsOrderBy!]
  ) {
    postByPostHash(postHash: $postHash) {
      postHash
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

export type FocusNotificationCategory = "money" | "message" | "stuffs";

export type FocusNotificationCounts = {
  unreadMessagesCount: number;
  unreadThreadsCount: number;
  totalUnclaimedMessageTipsUsdCents: number;
  unreadNotificationCount: number;
};

export type FocusNotificationItem = {
  id: string;
  category: FocusNotificationCategory;
  rawCategory: string;
  rawSubcategory: string;
  status: string | null;
  threadIdentifier: string;
  actorPublicKey: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorExtraData: Record<string, unknown> | null;
  actionText: string;
  previewText: string;
  previewImageUrl: string | null;
  previewVideoUrl: string | null;
  timestamp: string | null;
  unreadCount: number;
  isSpam: boolean;
  requiredPaymentAmountUsdCents: number;
  totalUnclaimedMessageTipsUsdCents: number;
  postHashHex: string | null;
  amountUsdCents: number;
};

export type FocusNotificationListResult = {
  items: FocusNotificationItem[];
  counts: FocusNotificationCounts;
  pageInfo: FocusPageInfo;
  nextOffset: number | null;
};

type FocusFeedPageInfo = {
  endCursor?: string | null;
  hasNextPage?: boolean | null;
};

const numberLike = z.union([z.number(), z.string()]).transform((value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
});

const stringLike = z.union([z.number(), z.string()]).transform((value) => {
  if (typeof value === "string") {
    return value;
  }

  return String(value);
});

const focusAccountWealthSchema = z.object({
  publicKey: z.string().nullish(),
  usdBalanceUsdCents: numberLike.nullish(),
  focusTokenBalanceUsdCents: numberLike.nullish(),
  desoBalanceUsdCents: numberLike.nullish(),
  desoBalanceNanos: stringLike.nullish(),
  focusTokenBalanceBaseUnits: stringLike.nullish(),
  focusTokenLockedBalanceUsdCents: numberLike.nullish(),
  focusTokenLockedBalanceBaseUnits: stringLike.nullish(),
  focusTokenTotalBalanceBaseUnits: stringLike.nullish(),
  usdBalanceBaseUnits: stringLike.nullish(),
  totalBalanceUsdCents: numberLike.nullish(),
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
  accountWealth: focusAccountWealthSchema.nullish(),
  accountWealthChainUser: focusAccountWealthSchema.nullish(),
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

const accountExtendedByUsernameResponseSchema = z.object({
  data: z.object({
    accountByUsername: focusAccountSchema.nullish(),
  }),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

const focusUserSearchAccountSchema = z
  .object({
    publicKey: z.string(),
    username: z.string().nullish(),
    extraData: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

const userSearchResponseSchema = z.object({
  data: z.object({
    accounts: z
      .object({
        nodes: z.array(focusUserSearchAccountSchema).default([]),
      })
      .nullish(),
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
  extraData: z.record(z.string(), z.unknown()).nullish(),
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

const focusApiNotificationUserSchema = z
  .object({
    PublicKey: z.string().nullish(),
    Username: z.string().nullish(),
    DisplayName: z.string().nullish(),
    TotalWealthUsdCents: numberLike.nullish(),
  })
  .passthrough();

const focusApiNotificationSchema = z
  .object({
    Id: z.string().nullish(),
    Category: z.string().nullish(),
    Subcategory: z.string().nullish(),
    Status: z.string().nullish(),
    UserPublicKeyBase58Check: z.string().nullish(),
    ActorPublicKeyBase58Check: z.string().nullish(),
    PostHashHex: z.string().nullish(),
    PaymentTokenPublicKeyBase58Check: z.string().nullish(),
    AmountNanosHex: z.string().nullish(),
    AmountUsdCents: numberLike.nullish(),
    IsParent: z.boolean().nullish(),
    ParentId: z.string().nullish(),
    ActorUserStatus: z.string().nullish(),
    ExtraData: z.record(z.string(), z.unknown()).nullish(),
    CreatedAt: z.string().nullish(),
    UpdatedAt: z.string().nullish(),
  })
  .passthrough();

const focusApiNotificationItemSchema = z
  .object({
    Notification: focusApiNotificationSchema.nullish(),
    User: focusApiNotificationUserSchema.nullish(),
    ActorUser: focusApiNotificationUserSchema.nullish(),
  })
  .passthrough();

const focusApiNotificationsResponseSchema = z.object({
  Notifications: z.array(focusApiNotificationItemSchema).default([]),
  Count: numberLike.nullish(),
  NextOffset: numberLike.nullish(),
});

const focusApiNotificationsReadResponseSchema = z
  .object({
    error: z.string().nullish(),
  })
  .passthrough();

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

const postRepliesPageResponseSchema = z.object({
  data: z.object({
    postByPostHash: z
      .object({
        postHash: z.string().nullish(),
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
export type FocusUserSearchAccount = z.infer<typeof focusUserSearchAccountSchema>;
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
export type FocusPostRepliesPageResult = {
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
        .join("; ") || "Profile by public key query returned errors",
    );
  }

  return parsed.data.data.accountByPublicKey ?? null;
}

export async function fetchAccountExtendedByUsername({
  username,
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
  DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  username: string;
  graphqlEndpoint?: string;
}): Promise<FocusAccount | null> {
  const body = {
    operationName: "AccountExtendedByUsername",
    query: ACCOUNT_EXTENDED_BY_USERNAME,
    variables: { username },
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

  const parsed = accountExtendedByUsernameResponseSchema.safeParse(json);
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
        .join("; ") || "Profile by username query returned errors",
    );
  }

  return parsed.data.data.accountByUsername ?? null;
}

export async function searchFocusAccountsByUsername({
  query,
  limit = 6,
  graphqlEndpoint = process.env.EXPO_PUBLIC_FOCUS_GRAPHQL_URL ??
  DEFAULT_FOCUS_GRAPHQL_URL,
}: {
  query: string;
  limit?: number;
  graphqlEndpoint?: string;
}): Promise<FocusUserSearchAccount[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  const body = {
    operationName: "UserSearch",
    query: USER_SEARCH_QUERY,
    variables: {
      includeAccounts: true,
      accountsFilter: {
        username: {
          likeInsensitive: `${normalizedQuery}%`,
        },
        isBlacklisted: {
          equalTo: false,
        },
      },
      orderBy: "DESO_LOCKED_NANOS_DESC",
      first: limit,
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

  const parsed = userSearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
      "Unable to parse user search response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "User search query returned errors",
    );
  }

  return parsed.data.data.accounts?.nodes ?? [];
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

export async function fetchPostRepliesPageByPostHash({
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
}): Promise<FocusPostRepliesPageResult> {
  const body = {
    operationName: "PostRepliesPageByPostHash",
    query: POST_REPLIES_PAGE_BY_POST_HASH_QUERY,
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
  const parsed = postRepliesPageResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
        "Unable to parse post replies response",
    );
  }

  if (parsed.data.errors?.length) {
    throw new Error(
      parsed.data.errors
        .map((err) => err.message)
        .filter(Boolean)
        .join("; ") || "Post replies query returned errors",
    );
  }

  const repliesConnection = parsed.data.data.postByPostHash?.replies ?? null;
  const replies = repliesConnection?.nodes ?? [];
  const totalCount = Number(repliesConnection?.totalCount ?? replies.length);
  const safeTotalCount = Number.isFinite(totalCount)
    ? Math.max(0, Math.floor(totalCount))
    : replies.length;
  const hasNextPage = Boolean(repliesConnection?.pageInfo?.hasNextPage);
  const nextOffset = hasNextPage ? offset + replies.length : null;

  return {
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

function asNonNegativeInt(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.floor(numeric));
}

type FocusApiNotificationItem = z.infer<typeof focusApiNotificationItemSchema>;
type FocusApiNotificationsResponse = z.infer<
  typeof focusApiNotificationsResponseSchema
>;

function toUpperToken(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function formatUsdCentsLabel(amountUsdCents: number): string {
  return `$${(amountUsdCents / 100).toFixed(2)}`;
}

function classifyNotificationCategory(
  rawCategory: string,
  rawSubcategory: string,
): FocusNotificationCategory {
  const category = toUpperToken(rawCategory);
  const subcategory = toUpperToken(rawSubcategory);

  if (
    category === "MESSAGES" ||
    subcategory.includes("MESSAGE") ||
    subcategory.includes("GROUP_CHAT")
  ) {
    return "message";
  }

  if (
    category === "EARNINGS" ||
    category === "MONEY" ||
    subcategory.startsWith("COIN_") ||
    subcategory.startsWith("RECEIVED_") ||
    subcategory.endsWith("_TIP")
  ) {
    return "money";
  }

  return "stuffs";
}

function buildNotificationActionText(
  category: FocusNotificationCategory,
  rawSubcategory: string,
  amountUsdCents: number,
): string {
  const subcategory = toUpperToken(rawSubcategory);

  if (subcategory === "FOLLOW") {
    return "followed you";
  }
  if (subcategory === "POST_REPLY") {
    return "commented on your post";
  }
  if (subcategory === "POST_REPOST") {
    return "reposted your post";
  }
  if (subcategory === "POST_QUOTE_REPOST") {
    return "quoted your post";
  }
  if (subcategory === "MENTION") {
    return "mentioned you";
  }
  if (subcategory === "UNPAID_MESSAGE" && amountUsdCents > 0) {
    return `requested ${formatUsdCentsLabel(amountUsdCents)} in messages`;
  }
  if (subcategory === "POST_TIP" && amountUsdCents > 0) {
    return `tipped you ${formatUsdCentsLabel(amountUsdCents)} 💎`;
  }
  if (subcategory.startsWith("REACTION_")) {
    return "reacted on your post";
  }
  if (subcategory.startsWith("RECEIVED_") && amountUsdCents > 0) {
    return `sent you ${formatUsdCentsLabel(amountUsdCents)}`;
  }
  if (category === "message") {
    return "sent you a message";
  }
  if (category === "money") {
    return amountUsdCents > 0
      ? `sent you ${formatUsdCentsLabel(amountUsdCents)}`
      : "triggered money activity";
  }
  return "interacted with your activity";
}

const NOTIFICATION_POST_PREVIEW_PLACEHOLDER = "__POST_PREVIEW_BY_HASH__";
const MAX_NOTIFICATION_PREVIEW_LENGTH = 220;
const MAX_NOTIFICATION_POST_PREVIEW_CACHE_SIZE = 500;
const UNREAD_NOTIFICATION_STATUS_TOKENS = new Set(["UNREAD", "PROCESSED"]);
type NotificationPostPreview = {
  previewText: string;
  previewImageUrl: string | null;
  previewVideoUrl: string | null;
};

const EMPTY_NOTIFICATION_POST_PREVIEW: NotificationPostPreview = {
  previewText: "",
  previewImageUrl: null,
  previewVideoUrl: null,
};

const notificationPostPreviewCache = new Map<string, NotificationPostPreview>();

function isLikelyHashString(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (/^0x[0-9a-f]{32,}$/i.test(normalized)) {
    return true;
  }

  return /^[0-9a-f]{32,}$/i.test(normalized);
}

function isPlaceholderNotificationPreview(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (
    normalized === "follow" ||
    normalized === "new follower" ||
    normalized === "view post"
  ) {
    return true;
  }

  if (normalized.startsWith("amount:")) {
    return true;
  }

  if (normalized.startsWith("post ")) {
    const maybeHash = normalized.slice(5).replace(/\.\.\./g, "");
    if (isLikelyHashString(maybeHash)) {
      return true;
    }
  }

  return false;
}

function normalizeNotificationPreviewText(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact || isLikelyHashString(compact)) {
    return "";
  }

  if (compact.length <= MAX_NOTIFICATION_PREVIEW_LENGTH) {
    return compact;
  }

  return `${compact.slice(0, MAX_NOTIFICATION_PREVIEW_LENGTH - 3)}...`;
}

function getFirstValidHttpUrl(
  values: (string | null | undefined)[] | null | undefined,
): string | null {
  if (!values?.length) {
    return null;
  }

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const candidate = value.trim();
    if (candidate && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getNotificationPostPreview(
  post: FocusFeedPost | null,
): NotificationPostPreview {
  if (!post) {
    return EMPTY_NOTIFICATION_POST_PREVIEW;
  }

  const body = normalizeNotificationPreviewText(post.body ?? "") ||
    normalizeNotificationPreviewText(post.repostedPost?.body ?? "");

  const previewImageUrl = getFirstValidHttpUrl(post.imageUrls) ||
    getFirstValidHttpUrl(post.repostedPost?.imageUrls);
  const previewVideoUrl = getFirstValidHttpUrl(post.videoUrls) ||
    getFirstValidHttpUrl(post.repostedPost?.videoUrls);

  return {
    previewText: body,
    previewImageUrl,
    previewVideoUrl,
  };
}

function cacheNotificationPostPreview(
  postHash: string,
  preview: NotificationPostPreview,
): void {
  if (!notificationPostPreviewCache.has(postHash)) {
    while (
      notificationPostPreviewCache.size >=
      MAX_NOTIFICATION_POST_PREVIEW_CACHE_SIZE
    ) {
      const oldestKey = notificationPostPreviewCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      notificationPostPreviewCache.delete(oldestKey);
    }
  }

  notificationPostPreviewCache.set(postHash, preview);
}

function getExtraDataPreview(
  extraData: Record<string, unknown> | null | undefined,
): string | null {
  if (!extraData) {
    return null;
  }

  const prioritizedKeys = [
    "Body",
    "Message",
    "MessageText",
    "Comment",
    "Reply",
    "Text",
    "Title",
  ];

  for (const key of prioritizedKeys) {
    const value = extraData[key];
    if (typeof value === "string") {
      const preview = normalizeNotificationPreviewText(value);
      if (preview && !isPlaceholderNotificationPreview(preview)) {
        return preview;
      }
    }
  }

  for (const [key, value] of Object.entries(extraData)) {
    if (key.toLowerCase().includes("hash")) {
      continue;
    }
    if (typeof value === "string") {
      const preview = normalizeNotificationPreviewText(value);
      if (preview && !isPlaceholderNotificationPreview(preview)) {
        return preview;
      }
    }
  }

  return null;
}

function buildNotificationPreviewText(
  category: FocusNotificationCategory,
  notification: FocusApiNotificationItem["Notification"],
  rawSubcategory: string,
): string {
  const subcategory = toUpperToken(rawSubcategory);
  const postHash = notification?.PostHashHex?.trim();
  if (postHash) {
    return NOTIFICATION_POST_PREVIEW_PLACEHOLDER;
  }

  if (category === "message") {
    return getExtraDataPreview(notification?.ExtraData) ?? "";
  }

  if (
    subcategory === "POST_REPLY" ||
    subcategory === "MENTION" ||
    subcategory === "POST_REPOST" ||
    subcategory === "POST_QUOTE_REPOST" ||
    subcategory.startsWith("REACTION_")
  ) {
    return getExtraDataPreview(notification?.ExtraData) ?? "";
  }

  return "";
}

function isUnreadNotificationStatus(status?: string | null): boolean {
  return UNREAD_NOTIFICATION_STATUS_TOKENS.has(toUpperToken(status));
}

function resolveFocusApiBaseUrl(focusApiBaseUrl?: string): string {
  return (
    focusApiBaseUrl ??
    process.env.EXPO_PUBLIC_FOCUS_API_V0_URL ??
    DEFAULT_FOCUS_API_V0_URL
  );
}

function buildFocusApiUrl(baseUrl: string, path: string): URL {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\/+/, ""), normalizedBase);
}

async function getFocusApiHeaders(
  userPublicKey: string,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Public-Key": userPublicKey,
  };

  try {
    const jwt = await identity.jwt();
    if (jwt?.trim()) {
      headers.Authorization = `Bearer ${jwt}`;
    }
  } catch {
    // Public-key header alone is enough for readonly notification fetches.
  }

  return headers;
}

async function fetchFocusApiNotificationsPage({
  userPublicKey,
  limit,
  offset,
  status,
  category,
  subcategory,
  focusApiBaseUrl,
}: {
  userPublicKey: string;
  limit: number;
  offset: number;
  status?: string;
  category?: string;
  subcategory?: string;
  focusApiBaseUrl?: string;
}): Promise<FocusApiNotificationsResponse> {
  const normalizedPublicKey = userPublicKey.trim();
  if (!normalizedPublicKey) {
    throw new Error("Public key is required to fetch notifications");
  }

  const baseUrl = resolveFocusApiBaseUrl(focusApiBaseUrl);
  const url = buildFocusApiUrl(
    baseUrl,
    `notifications/for/${encodeURIComponent(normalizedPublicKey)}`,
  );
  url.searchParams.set("limit", String(Math.max(1, Math.floor(limit))));
  url.searchParams.set("offset", String(Math.max(0, Math.floor(offset))));

  if (status?.trim()) {
    url.searchParams.set("status", status.trim().toUpperCase());
  }
  if (category?.trim()) {
    url.searchParams.set("category", category.trim().toUpperCase());
  }
  if (subcategory?.trim()) {
    url.searchParams.set("subcategory", subcategory.trim().toUpperCase());
  }

  const headers = await getFocusApiHeaders(normalizedPublicKey);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Focus notifications request failed with status ${response.status}. Response snippet: ${text.slice(
        0,
        200,
      )}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Expected JSON response from Focus API but received '${contentType}'. Response snippet: ${text.slice(
        0,
        120,
      )}`,
    );
  }

  const json = await response.json();
  const parsed = focusApiNotificationsResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
      "Unable to parse Focus notifications response",
    );
  }

  return parsed.data;
}

export async function markAllFocusNotificationsRead({
  userPublicKey,
  focusApiBaseUrl,
}: {
  userPublicKey: string;
  focusApiBaseUrl?: string;
}): Promise<void> {
  const normalizedPublicKey = userPublicKey.trim();
  if (!normalizedPublicKey) {
    throw new Error("Public key is required to mark notifications as read");
  }

  const baseUrl = resolveFocusApiBaseUrl(focusApiBaseUrl);
  const url = buildFocusApiUrl(baseUrl, "notifications/read");
  const headers = await getFocusApiHeaders(normalizedPublicKey);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Focus notifications read request failed with status ${response.status}. Response snippet: ${text.slice(
        0,
        200,
      )}`,
    );
  }

  if (response.status === 204) {
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return;
  }

  const json = await response.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return;
  }

  const parsed = focusApiNotificationsReadResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
      "Unable to parse Focus notifications read response",
    );
  }

  const apiError = parsed.data.error?.trim();
  if (apiError) {
    throw new Error(apiError);
  }
}

function mapFocusApiNotificationItem(
  node: FocusApiNotificationItem,
): FocusNotificationItem | null {
  const notification = node.Notification;
  if (!notification) {
    return null;
  }

  const notificationId = notification.Id?.trim();
  if (!notificationId) {
    return null;
  }

  const rawCategory = toUpperToken(notification.Category);
  const rawSubcategory = toUpperToken(notification.Subcategory);
  const category = classifyNotificationCategory(rawCategory, rawSubcategory);
  const amountUsdCents = asNonNegativeInt(notification.AmountUsdCents);
  const actionText = buildNotificationActionText(
    category,
    rawSubcategory,
    amountUsdCents,
  );
  const previewText = buildNotificationPreviewText(
    category,
    notification,
    rawSubcategory,
  );
  const postHashHex = notification.PostHashHex?.trim() || null;
  const threadIdentifier = postHashHex || notificationId;
  const actorPublicKey =
    node.ActorUser?.PublicKey?.trim() ||
    notification.ActorPublicKeyBase58Check?.trim() ||
    null;
  const actorUsername = node.ActorUser?.Username?.trim() || null;
  const actorDisplayName = node.ActorUser?.DisplayName?.trim() || null;
  const unreadCount = isUnreadNotificationStatus(notification.Status) ? 1 : 0;
  const isSpam = toUpperToken(notification.ActorUserStatus).includes("SPAM");
  const requiredPaymentAmountUsdCents =
    rawSubcategory === "UNPAID_MESSAGE" ? amountUsdCents : 0;
  const totalUnclaimedMessageTipsUsdCents =
    rawSubcategory === "POST_TIP" || rawSubcategory.startsWith("RECEIVED_")
      ? amountUsdCents
      : 0;

  return {
    id: notificationId,
    category,
    rawCategory,
    rawSubcategory,
    status: notification.Status?.trim() || null,
    threadIdentifier,
    actorPublicKey,
    actorUsername,
    actorDisplayName,
    actorExtraData: null,
    actionText,
    previewText,
    previewImageUrl: null,
    previewVideoUrl: null,
    timestamp: notification.CreatedAt ?? notification.UpdatedAt ?? null,
    unreadCount,
    isSpam,
    requiredPaymentAmountUsdCents,
    totalUnclaimedMessageTipsUsdCents,
    postHashHex,
    amountUsdCents,
  };
}

async function hydrateNotificationPostPreviews(
  items: FocusNotificationItem[],
  readerPublicKey: string,
): Promise<FocusNotificationItem[]> {
  const postHashes = Array.from(
    new Set(
      items.flatMap((item) =>
        item.previewText === NOTIFICATION_POST_PREVIEW_PLACEHOLDER &&
          item.postHashHex
          ? [item.postHashHex]
          : []
      ),
    ),
  );

  if (postHashes.length === 0) {
    return items.map((item) =>
      item.previewText === NOTIFICATION_POST_PREVIEW_PLACEHOLDER
        ? {
          ...item,
          previewText: "",
          previewImageUrl: null,
          previewVideoUrl: null,
        }
        : item
    );
  }

  const postHashesToFetch = postHashes.filter(
    (postHash) => !notificationPostPreviewCache.has(postHash),
  );

  await Promise.all(
    postHashesToFetch.map(async (postHash) => {
      try {
        const post = await fetchPostByPostHash({
          postHash,
          readerPublicKey,
        });
        cacheNotificationPostPreview(postHash, getNotificationPostPreview(post));
      } catch {
        // Network/API errors are transient; keep hash uncached so next refresh can retry.
      }
    }),
  );

  return items.map((item) => {
    if (item.previewText !== NOTIFICATION_POST_PREVIEW_PLACEHOLDER) {
      return item;
    }

    if (!item.postHashHex) {
      return {
        ...item,
        previewText: "",
        previewImageUrl: null,
        previewVideoUrl: null,
      };
    }

    const preview = notificationPostPreviewCache.get(item.postHashHex) ??
      EMPTY_NOTIFICATION_POST_PREVIEW;

    return {
      ...item,
      previewText: preview.previewText,
      previewImageUrl: preview.previewImageUrl,
      previewVideoUrl: preview.previewVideoUrl,
    };
  });
}

export async function fetchFocusNotificationCounts({
  userPublicKey,
  focusApiBaseUrl,
}: {
  userPublicKey: string;
  focusApiBaseUrl?: string;
}): Promise<FocusNotificationCounts> {
  const normalizedPublicKey = userPublicKey.trim();
  if (!normalizedPublicKey) {
    throw new Error("Public key is required to fetch notification counts");
  }

  const [unreadNotifications, unreadMessages] = await Promise.all([
    fetchFocusApiNotificationsPage({
      userPublicKey: normalizedPublicKey,
      limit: 1,
      offset: 0,
      status: "PROCESSED",
      focusApiBaseUrl,
    }),
    fetchFocusApiNotificationsPage({
      userPublicKey: normalizedPublicKey,
      limit: 1,
      offset: 0,
      status: "PROCESSED",
      category: "MESSAGES",
      focusApiBaseUrl,
    }),
  ]);

  const unreadMessagesCount = asNonNegativeInt(unreadMessages.Count);
  return {
    unreadMessagesCount,
    unreadThreadsCount: unreadMessagesCount,
    totalUnclaimedMessageTipsUsdCents: 0,
    unreadNotificationCount: asNonNegativeInt(unreadNotifications.Count),
  };
}

export async function fetchFocusNotifications({
  userPublicKey,
  first = 30,
  offset = 0,
  filter,
  focusApiBaseUrl,
}: {
  userPublicKey: string;
  first?: number;
  offset?: number;
  filter?: Record<string, unknown>;
  focusApiBaseUrl?: string;
}): Promise<FocusNotificationListResult> {
  const normalizedPublicKey = userPublicKey.trim();
  if (!normalizedPublicKey) {
    throw new Error("Public key is required to fetch notifications");
  }

  const categoryFilter =
    typeof filter?.category === "string" ? filter.category : undefined;
  const subcategoryFilter =
    typeof filter?.subcategory === "string" ? filter.subcategory : undefined;
  const statusFilter =
    typeof filter?.status === "string" ? filter.status : undefined;

  const [page, unreadNotifications, unreadMessages] = await Promise.all([
    fetchFocusApiNotificationsPage({
      userPublicKey: normalizedPublicKey,
      limit: first,
      offset,
      status: statusFilter,
      category: categoryFilter,
      subcategory: subcategoryFilter,
      focusApiBaseUrl,
    }),
    fetchFocusApiNotificationsPage({
      userPublicKey: normalizedPublicKey,
      limit: 1,
      offset: 0,
      status: "PROCESSED",
      focusApiBaseUrl,
    }),
    fetchFocusApiNotificationsPage({
      userPublicKey: normalizedPublicKey,
      limit: 1,
      offset: 0,
      status: "PROCESSED",
      category: "MESSAGES",
      focusApiBaseUrl,
    }),
  ]);

  const totalCount = asNonNegativeInt(page.Count);
  const mappedItems = page.Notifications.map(mapFocusApiNotificationItem).filter(
    (item): item is FocusNotificationItem => item !== null,
  );
  const items = await hydrateNotificationPostPreviews(
    mappedItems,
    normalizedPublicKey,
  );

  const fallbackNextOffset = offset + items.length < totalCount
    ? offset + items.length
    : null;
  const apiNextOffset = asNonNegativeInt(page.NextOffset);
  const nextOffset = apiNextOffset > offset && apiNextOffset < totalCount
    ? apiNextOffset
    : fallbackNextOffset;

  const pageInfo: FocusPageInfo = {
    endCursor: nextOffset !== null ? String(nextOffset) : null,
    hasNextPage: nextOffset !== null,
    hasPreviousPage: offset > 0,
    startCursor: offset > 0 ? String(offset) : null,
  };

  const unreadMessagesCount = asNonNegativeInt(unreadMessages.Count);
  const counts: FocusNotificationCounts = {
    unreadMessagesCount,
    unreadThreadsCount: unreadMessagesCount,
    totalUnclaimedMessageTipsUsdCents: 0,
    unreadNotificationCount: asNonNegativeInt(unreadNotifications.Count),
  };

  return {
    items,
    counts,
    pageInfo,
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
