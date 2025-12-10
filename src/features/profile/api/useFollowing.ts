import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { fetchFollowingList, type FocusAccount } from "@/lib/focus/graphql";
import { profileKeys } from "./keys";

const PAGE_SIZE = 20;

type FollowingPage = Awaited<ReturnType<typeof fetchFollowingList>>;

type UseFollowingParams = {
  publicKey?: string;
  enabled?: boolean;
};

export function useFollowing({ publicKey, enabled = true }: UseFollowingParams) {
  const query = useInfiniteQuery<FollowingPage, Error, InfiniteData<FollowingPage>, ReturnType<typeof profileKeys.following>, number>({
    queryKey: profileKeys.following(publicKey || ""),
    queryFn: ({ pageParam }) => {
      if (!publicKey) throw new Error("Public key is required to load following");
      return fetchFollowingList({ publicKey, first: PAGE_SIZE, offset: pageParam ?? 0 });
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
