import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { fetchFollowersList, type FocusAccount } from "@/lib/focus/graphql";
import { profileKeys } from "./keys";

const PAGE_SIZE = 20;

type FollowersPage = Awaited<ReturnType<typeof fetchFollowersList>>;

type UseFollowersParams = {
  publicKey?: string;
  enabled?: boolean;
};

export function useFollowers({ publicKey, enabled = true }: UseFollowersParams) {
  const query = useInfiniteQuery<FollowersPage, Error, InfiniteData<FollowersPage>, ReturnType<typeof profileKeys.followers>, number>({
    queryKey: profileKeys.followers(publicKey || ""),
    queryFn: ({ pageParam }) => {
      if (!publicKey) throw new Error("Public key is required to load followers");
      return fetchFollowersList({ publicKey, first: PAGE_SIZE, offset: pageParam ?? 0 });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.pageInfo?.hasNextPage ? (lastPageParam ?? 0) + PAGE_SIZE : undefined,
    enabled: Boolean(publicKey) && enabled,
    staleTime: 1000 * 60 * 5,
  });

  const accounts: FocusAccount[] = query.data?.pages.flatMap((page) => page.accounts) ?? [];

  return {
    ...query,
    accounts,
  };
}
