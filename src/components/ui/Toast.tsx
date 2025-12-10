import React from 'react';
import { View } from 'react-native';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { useAccentColor } from '@/state/theme/useAccentColor';
import { useColorScheme } from 'nativewind';
import { Feather } from '@expo/vector-icons';

export function AppToast() {
  const { accentColor, accentSoft } = useAccentColor();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const toastConfig: ToastConfig = {
    success: (props) => (
      <BaseToast
        {...props}
        style={{
          borderLeftWidth: 0,
          borderRadius: 16,
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          paddingVertical: 12,
          paddingHorizontal: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.4 : 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
        contentContainerStyle={{
          paddingHorizontal: 12,
        }}
        text1Style={{
          fontSize: 15,
          fontWeight: '700',
          color: isDark ? '#f8fafc' : '#0f172a',
          marginBottom: 2,
        }}
        text2Style={{
          fontSize: 13,
          fontWeight: '500',
          color: isDark ? '#94a3b8' : '#64748b',
          lineHeight: 18,
        }}
        renderLeadingIcon={() => (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 4,
            }}
          >
            <Feather name="check" size={20} color={accentColor} />
          </View>
        )}
      />
    ),
    error: (props) => (
      <ErrorToast
        {...props}
        style={{
          borderLeftWidth: 0,
          borderRadius: 16,
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          paddingVertical: 12,
          paddingHorizontal: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.4 : 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
        contentContainerStyle={{
          paddingHorizontal: 12,
        }}
        text1Style={{
          fontSize: 15,
          fontWeight: '700',
          color: isDark ? '#f8fafc' : '#0f172a',
          marginBottom: 2,
        }}
        text2Style={{
          fontSize: 13,
          fontWeight: '500',
          color: isDark ? '#94a3b8' : '#64748b',
          lineHeight: 18,
        }}
        renderLeadingIcon={() => (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 4,
            }}
          >
            <Feather name="x" size={20} color="#ef4444" />
          </View>
        )}
      />
    ),
    info: (props) => (
      <BaseToast
        {...props}
        style={{
          borderLeftWidth: 0,
          borderRadius: 16,
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          paddingVertical: 12,
          paddingHorizontal: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.4 : 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
        contentContainerStyle={{
          paddingHorizontal: 12,
        }}
        text1Style={{
          fontSize: 15,
          fontWeight: '700',
          color: isDark ? '#f8fafc' : '#0f172a',
          marginBottom: 2,
        }}
        text2Style={{
          fontSize: 13,
          fontWeight: '500',
          color: isDark ? '#94a3b8' : '#64748b',
          lineHeight: 18,
        }}
        renderLeadingIcon={() => (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 4,
            }}
          >
            <Feather name="info" size={20} color="#3b82f6" />
          </View>
        )}
      />
    ),
  };

  return <Toast config={toastConfig} />;
}

// Export toast methods for easy access
export { Toast };
