import { request, gql } from 'graphql-request';

const FOCUS_GRAPHQL_API = 'https://graphql.focus.xyz/graphql';

export interface UserSearchResult {
    publicKey: string;
    username: string;
    extraData?: {
        DisplayName?: string;
        FeaturedImageURL?: string;
        LargeProfilePicURL?: string;
    };
}

const USER_SEARCH_QUERY = gql`
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

export const searchUsers = async (query: string, limit: number = 6): Promise<UserSearchResult[]> => {
    if (!query) return [];

    try {
        const variables = {
            includeAccounts: true,
            accountsFilter: {
                username: {
                    likeInsensitive: `${query}%`,
                },
                isBlacklisted: {
                    equalTo: false,
                },
            },
            orderBy: "DESO_LOCKED_NANOS_DESC",
            first: limit,
        };

        const data: any = await request(FOCUS_GRAPHQL_API, USER_SEARCH_QUERY, variables);

        return data?.accounts?.nodes || [];
    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
};
