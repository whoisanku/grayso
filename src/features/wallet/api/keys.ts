export const walletKeys = {
  all: ["wallet"] as const,
  userSearch: (query: string) => [...walletKeys.all, "user-search", query] as const,
};
