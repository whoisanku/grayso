export const notificationsKeys = {
  base: ["notifications"] as const,
  counts: (userPublicKey: string) =>
    [...notificationsKeys.base, "counts", userPublicKey] as const,
  list: (userPublicKey: string, pageSize: number) =>
    [...notificationsKeys.base, "list", userPublicKey, pageSize] as const,
};
