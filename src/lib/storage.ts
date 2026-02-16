import AsyncStorage from "@react-native-async-storage/async-storage";

export const StorageKeys = {
  USER_SETTINGS: "user_settings",
  THREAD_SETTINGS: "thread_settings",
};

export const StorageService = {
  setItem: async (key: string, value: string | number | boolean) => {
    try {
      await AsyncStorage.setItem(key, String(value));
    } catch (e) {
      console.error("Failed to set item", e);
    }
  },

  getString: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.error("Failed to get string", e);
      return null;
    }
  },

  getNumber: async (key: string) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? Number(value) : undefined;
    } catch (e) {
      console.error("Failed to get number", e);
      return undefined;
    }
  },

  getBoolean: async (key: string) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value === "true";
    } catch (e) {
      console.error("Failed to get boolean", e);
      return undefined;
    }
  },

  delete: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error("Failed to delete item", e);
    }
  },

  clearAll: async () => {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.error("Failed to clear storage", e);
    }
  },

  saveThreadSettings: async (
    userPublicKey: string,
    payload: Record<string, "inbox" | "spam">,
  ) => {
    const key = `${StorageKeys.THREAD_SETTINGS}_${userPublicKey}`;
    try {
      const json = JSON.stringify(payload);
      await AsyncStorage.setItem(key, json);
    } catch (e) {
      console.error("Failed to save thread settings", e);
    }
  },

  getThreadSettings: async (userPublicKey: string) => {
    const key = `${StorageKeys.THREAD_SETTINGS}_${userPublicKey}`;
    try {
      const json = await AsyncStorage.getItem(key);
      if (json) {
        return JSON.parse(json);
      }
    } catch (e) {
      console.error("Failed to load thread settings", e);
    }
    return null as Record<string, "inbox" | "spam"> | null;
  },
};
