import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
    CHAT_HISTORY: 'chat_history',
    USER_SETTINGS: 'user_settings',
    CONVERSATIONS: 'conversations',
};

export const StorageService = {
    setItem: async (key: string, value: string | number | boolean) => {
        try {
            await AsyncStorage.setItem(key, String(value));
        } catch (e) {
            console.error('Failed to set item', e);
        }
    },

    getString: async (key: string) => {
        try {
            return await AsyncStorage.getItem(key);
        } catch (e) {
            console.error('Failed to get string', e);
            return null;
        }
    },

    getNumber: async (key: string) => {
        try {
            const value = await AsyncStorage.getItem(key);
            return value ? Number(value) : undefined;
        } catch (e) {
            console.error('Failed to get number', e);
            return undefined;
        }
    },

    getBoolean: async (key: string) => {
        try {
            const value = await AsyncStorage.getItem(key);
            return value === 'true';
        } catch (e) {
            console.error('Failed to get boolean', e);
            return undefined;
        }
    },

    delete: async (key: string) => {
        try {
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.error('Failed to delete item', e);
        }
    },

    clearAll: async () => {
        try {
            await AsyncStorage.clear();
        } catch (e) {
            console.error('Failed to clear storage', e);
        }
    },

    // Chat specific helpers
    saveChatHistory: async (conversationId: string, messages: any[]) => {
        const key = `${StorageKeys.CHAT_HISTORY}_${conversationId}`;
        try {
            const json = JSON.stringify(messages);
            await AsyncStorage.setItem(key, json);
        } catch (e) {
            console.error('Failed to save chat history', e);
        }
    },

    getChatHistory: async (conversationId: string) => {
        const key = `${StorageKeys.CHAT_HISTORY}_${conversationId}`;
        try {
            const json = await AsyncStorage.getItem(key);
            if (json) {
                return JSON.parse(json);
            }
        } catch (e) {
            console.error('Failed to parse chat history', e);
        }
        return null;
    },

    saveConversations: async (
        userPublicKey: string,
        mailbox: "inbox" | "spam",
        payload: unknown
    ) => {
        const key = `${StorageKeys.CONVERSATIONS}_${mailbox}_${userPublicKey}`;
        try {
            const json = JSON.stringify(payload);
            await AsyncStorage.setItem(key, json);
        } catch (e) {
            console.error('Failed to save conversations cache', e);
        }
    },

    getConversations: async (userPublicKey: string, mailbox: "inbox" | "spam") => {
        const key = `${StorageKeys.CONVERSATIONS}_${mailbox}_${userPublicKey}`;
        try {
            const json = await AsyncStorage.getItem(key);
            if (json) {
                return JSON.parse(json);
            }
        } catch (e) {
            console.error('Failed to load conversations cache', e);
        }
        return null;
    },
};
