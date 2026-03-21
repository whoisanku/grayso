import { useQuery } from "@tanstack/react-query";

import { searchKeys } from "@/features/search/api/keys";
import {
  searchFocusAccountsByUsername,
  type FocusUserSearchAccount,
} from "@/lib/focus/graphql";

export function useSearchAccounts(query: string) {
  const normalizedQuery = query.trim();

  return useQuery<FocusUserSearchAccount[]>({
    queryKey: searchKeys.accounts(normalizedQuery),
    queryFn: () =>
      searchFocusAccountsByUsername({
        query: normalizedQuery,
        limit: 8,
      }),
    enabled: normalizedQuery.length > 0,
    staleTime: 1000 * 30,
  });
}
