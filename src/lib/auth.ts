import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '@/state/queryClient';

/**
 * Clear all app storage on logout
 * Ensures clean state when switching accounts
 */
export async function clearAllStorage(): Promise<void> {
  try {
    // Clear TanStack Query cache
    queryClient.clear();

    // Clear AsyncStorage (mobile) or localStorage (web)
    if (Platform.OS === 'web') {
      // Web: Clear localStorage except DeSo identity data
      const keysToPreserve = [
        'deso-identity',
        'deso_identity_users', 
        'deso_identity_ approved_derivations',
      ];
      
      const allKeys = Object.keys(localStorage);
      allKeys.forEach((key) => {
        const shouldPreserve = keysToPreserve.some((preserved) =>
          key.toLowerCase().includes(preserved.toLowerCase())
        );
        if (!shouldPreserve) {
          localStorage.removeItem(key);
        }
      });
    } else {
      // Mobile: Clear AsyncStorage
      await AsyncStorage.clear();
    }

    console.log('[Auth] Storage cleared successfully');
  } catch (error) {
    console.error('[Auth] Failed to clear storage:', error);
    throw error;
  }
}

/**
 * Handle logout with storage cleanup
 */
export async function handleLogout(logoutFn: () => Promise<void> | void): Promise<void> {
  try {
    // Call DeSo logout FIRST (needs public key to be present)
    await logoutFn();
    
    // Then clear all app storage after successful logout
    await clearAllStorage();
  } catch (error) {
    console.error('[Auth] Logout failed:', error);
    throw error;
  }
}
