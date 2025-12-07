import React, { useState, useCallback, useEffect, useRef, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { buildProfilePictureUrl } from "deso-protocol";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChatType } from "deso-protocol";
import { LiquidGlassView } from "../../utils/liquidGlass";
import {
  searchProfiles,
  ProfileSearchResult,
} from "../../services/desoGraphql";
import { FALLBACK_PROFILE_IMAGE, formatPublicKey } from "../../utils/deso";
import { RootStackParamList } from "../../navigation/types";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../../constants/messaging";
import { useAccentColor } from "../../state/theme/useAccentColor";

type NewChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

function ProfileItem({
  item,
  onSelect,
  isDark,
}: {
  item: ProfileSearchResult;
  onSelect: (profile: ProfileSearchResult) => void;
  isDark: boolean;
}) {
  const avatarUrl = item.publicKey
    ? buildProfilePictureUrl(item.publicKey, {
        fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
      })
    : FALLBACK_PROFILE_IMAGE;

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3"
      onPress={() => onSelect(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: avatarUrl }}
        className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700"
      />
      <View className="ml-3 flex-1">
        <Text
          className="text-base font-semibold text-slate-900 dark:text-white"
          numberOfLines={1}
        >
          {item.username || formatPublicKey(item.publicKey)}
        </Text>
        {item.username && (
          <Text
            className="text-sm text-slate-500 dark:text-slate-400"
            numberOfLines={1}
          >
            {formatPublicKey(item.publicKey)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function NewChatScreen() {
  const { isDark, accentColor } = useAccentColor();
  const insets = useSafeAreaInsets();
  const { currentUser } = useContext(DeSoIdentityContext);
  const navigation = useNavigation<NewChatScreenNavigationProp>();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);
      try {
        const profiles = await searchProfiles({ query: searchQuery, limit: 6 });
        const filtered = profiles.filter(
          (p) => p.publicKey !== currentUser?.PublicKeyBase58Check
        );
        setResults(filtered);
      } catch (error) {
        console.error("[NewChatScreen] search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentUser?.PublicKeyBase58Check]);

  const handleSelectProfile = useCallback(
    (profile: ProfileSearchResult) => {
      Keyboard.dismiss();
      
      const userPublicKey = currentUser?.PublicKeyBase58Check;
      if (!userPublicKey) return;

      // Navigate to conversation
      navigation.replace("Conversation", {
        threadPublicKey: profile.publicKey,
        chatType: "DM" as ChatType,
        userPublicKey,
        userAccessGroupKeyName: DEFAULT_KEY_MESSAGING_GROUP_NAME,
        recipientInfo: {
          username: profile.username,
          publicKey: profile.publicKey,
        },
      });
    },
    [currentUser?.PublicKeyBase58Check, navigation]
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  return (
    <View 
      className="flex-1 bg-white dark:bg-[#0a0f1a]"
      style={{ paddingTop: Platform.OS === "android" ? insets.top : 0 }}
    >
      {/* Header - matching group composer style */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
        <Text className="text-xl font-bold text-[#111] dark:text-white">
          New Message
        </Text>
        <TouchableOpacity onPress={handleClose} className="p-1">
          <Feather name="x" size={24} color={isDark ? "#fff" : "#111"} />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View className="px-4 py-3">
        <View className="h-12 flex-row items-center rounded-xl bg-slate-100 px-4 dark:bg-slate-800">
          <Feather
            name="search"
            size={18}
            color={isDark ? "#64748b" : "#94a3b8"}
          />
          <TextInput
            ref={inputRef}
            className="ml-3 flex-1 text-base text-slate-900 dark:text-white"
            placeholder="Search username..."
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Results */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={accentColor} />
        </View>
      ) : hasSearched && results.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Feather
            name="user-x"
            size={48}
            color={isDark ? "#334155" : "#cbd5e1"}
          />
          <Text className="mt-4 text-center text-base text-slate-500 dark:text-slate-400">
            No users found
          </Text>
        </View>
      ) : !hasSearched ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Feather
              name="search"
              size={28}
              color={isDark ? "#64748b" : "#94a3b8"}
            />
          </View>
          <Text className="mt-4 text-center text-base font-medium text-slate-900 dark:text-white">
            Find someone to chat with
          </Text>
          <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
            Search by username to start a conversation
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.publicKey}
          renderItem={({ item }) => (
            <ProfileItem
              item={item}
              onSelect={handleSelectProfile}
              isDark={isDark}
            />
          )}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
