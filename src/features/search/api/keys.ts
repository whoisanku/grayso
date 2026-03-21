export const searchKeys = {
  all: ["search"] as const,
  accounts: (query: string) => [...searchKeys.all, "accounts", query] as const,
};
