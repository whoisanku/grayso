// src/view/components/desktop/DesktopLeftNav.tsx
// Fixed-position left navigation for desktop web, inspired by Bluesky

import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

import { RootStackParamList, HomeTabParamList } from '../../../navigation/types';
import {
  useLayoutBreakpoints,
  LEFT_NAV_WIDTH,
  LEFT_NAV_MINIMAL_WIDTH,
  CENTER_COLUMN_OFFSET,
} from '../../../alf/breakpoints';
import { useAccentColor } from '../../../state/theme/useAccentColor';
import { WalletSwitcher } from '@/features/auth/components/WalletSwitcher';
import SettingsIcon from '../../../assets/navIcons/settings.svg';
import SettingsIconFilled from '../../../assets/navIcons/settings-filled.svg';
import { ChatIcon, ChatIconFilled } from '@/components/icons/ChatIcon';
import { ProfileIcon, ProfileIconFilled } from '@/components/icons/ProfileIcon';

const NAV_ICON_WIDTH = 24;
type NavIconComponent = React.ComponentType<{
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number | string;
  fill?: string;
}>;

interface NavItemProps {
  Icon: NavIconComponent;
  ActiveIcon: NavIconComponent;
  label: string;
  isActive: boolean;
  onPress: () => void;
  minimal: boolean;
  isDark: boolean;
}

function NavItem({
  Icon,
  ActiveIcon,
  label,
  isActive,
  onPress,
  minimal,
  isDark,
}: NavItemProps) {
  // Filled icon when active, outline when inactive
  const InUseIcon = isActive ? ActiveIcon : Icon;
  const activeColor = isDark ? '#f8fafc' : '#0f172a'; // Dark text for light mode, light for dark mode
  const inactiveColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <Pressable
      onPress={onPress}
      className={[
        "flex-row items-center gap-2 rounded-lg px-2 py-2 w-full transition-colors duration-150 hover:bg-slate-200 dark:hover:bg-slate-800 active:opacity-80 cursor-pointer",
        minimal ? "justify-center" : "",
      ].join(" ")}
    >
      <View
        className={[
          "items-center justify-center",
          minimal ? "w-9 h-9" : "w-6 h-6",
        ].join(" ")}
      >
        <InUseIcon
          width={NAV_ICON_WIDTH}
          height={NAV_ICON_WIDTH}
          stroke={isActive ? activeColor : inactiveColor}
          strokeWidth={isActive ? 1.5 : 1.6}
          fill={isActive ? activeColor : 'none'}
        />
      </View>
      {!minimal && (
        <Text
          className="text-[15px]"
          style={{
            fontWeight: isActive ? '700' : '400',
            color: isActive ? activeColor : (isDark ? '#e2e8f0' : '#475569'),
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

interface DesktopLeftNavProps {
  activeTab?: keyof HomeTabParamList | 'Settings';
  onTabChange?: (tab: keyof HomeTabParamList) => void;
}

export function DesktopLeftNav({ activeTab = 'Messages', onTabChange }: DesktopLeftNavProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { leftNavMinimal, centerColumnOffset } = useLayoutBreakpoints();
  const { accentColor } = useAccentColor();

  // Get current route to determine if we're on Settings or Profile screen
  const currentRouteName = useNavigationState((state) => {
    if (!state || !state.routes || state.routes.length === 0) return '';
    const route = state.routes[state.index];
    return route?.name || '';
  });

  // Determine which nav item is active based on route
  const isProfileActive = currentRouteName === 'Profile' || activeTab === 'Profile';
  const isSettingsActive = currentRouteName === 'Settings';
  const isChatsActive = !isProfileActive && !isSettingsActive && (activeTab === 'Messages' || currentRouteName === 'Main');

  const navItems: {
    key: string;
    label: string;
    Icon: NavIconComponent;
    ActiveIcon: NavIconComponent;
    isActive: boolean;
    onPress: () => void;
  }[] = [
    {
      key: 'Messages',
      label: 'Chats',
      Icon: ChatIcon as unknown as NavIconComponent,
      ActiveIcon: ChatIconFilled as unknown as NavIconComponent,
      isActive: isChatsActive,
      onPress: () => {
        // Navigate to Main with Messages screen
        rootNavigation.navigate('Main', { screen: 'Messages' });
      },
    },
    {
      key: 'Profile',
      label: 'Profile',
      Icon: ProfileIcon as unknown as NavIconComponent,
      ActiveIcon: ProfileIconFilled as unknown as NavIconComponent,
      isActive: isProfileActive,
      onPress: () => {
        // Navigate to Main with Profile screen - this will update URL to /profile
        rootNavigation.navigate('Main', { screen: 'Profile' });
      },
    },
    {
      key: 'Settings',
      label: 'Settings',
      Icon: SettingsIcon,
      ActiveIcon: SettingsIconFilled,
      isActive: isSettingsActive,
      onPress: () => {
        // Settings is a separate screen in the root stack - URL will be /settings
        rootNavigation.navigate('Settings');
      },
    },
  ];

  const width = leftNavMinimal ? LEFT_NAV_MINIMAL_WIDTH : LEFT_NAV_WIDTH;
  const translateX = -300 + (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0);

  return (
    <View
      className={[
        "absolute top-0 h-full z-10",
        leftNavMinimal ? "items-center px-3" : "px-4",
      ].join(" ")}
      style={{
        left: "50%",
        width,
        paddingTop: insets.top + 10,
        paddingBottom: insets.bottom + 10,
        backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
        borderRightWidth: 1,
        borderRightColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)',
        transform: [
          { translateX: translateX },
          { translateX: -width },
        ],
        ...(Platform.OS === 'web' && {
          position: 'fixed',
          maxHeight: '100vh',
          overflowY: 'auto',
        }),
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={leftNavMinimal ? "items-center pb-6" : "pb-6"}
      >
        <WalletSwitcher minimal={leftNavMinimal} />

        {/* Navigation Items */}
        {navItems.map((item) => (
          <NavItem
            key={item.key}
            Icon={item.Icon}
            ActiveIcon={item.ActiveIcon}
            label={item.label}
            isActive={item.isActive}
            onPress={item.onPress}
            minimal={leftNavMinimal}
            isDark={isDark}
          />
        ))}

        {/* Post Button - using accent color */}
        {!leftNavMinimal ? (
          <Pressable
            onPress={() => rootNavigation.navigate('Composer')}
            className="mt-4 flex-row items-center justify-center rounded-full px-5 py-2.5 active:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            <Feather name="edit-2" size={16} color="#fff" />
            <Text className="ml-2 text-sm font-semibold text-white">Post</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => rootNavigation.navigate('Composer')}
            className="mt-4 h-11 w-11 items-center justify-center rounded-full active:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            <Feather name="edit-2" size={18} color="#fff" />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
