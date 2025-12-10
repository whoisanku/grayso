export const profileKeys = {
  base: ["profile"] as const,
  account: (publicKey: string) => [...profileKeys.base, "account", publicKey] as const,
  followers: (publicKey: string) => [...profileKeys.base, "followers", publicKey] as const,
  following: (publicKey: string) => [...profileKeys.base, "following", publicKey] as const,
};
