export const profileKeys = {
  base: ["profile"] as const,
  account: (publicKey: string) => [...profileKeys.base, "account", publicKey] as const,
};
