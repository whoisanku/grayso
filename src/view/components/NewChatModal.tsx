import React, { useState, useCallback, useEffect, useRef, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Keyboard,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { buildProfilePictureUrl } from "deso-protocol";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeSoIdentityContext } from "react-deso-protocol";
import { searchUsers, UserSearchResult } from "../../services/userSearch";
import { FALLBACK_PROFILE_IMAGE } from "../../utils/deso";
import { LiquidGlassView } from "../../utils/liquidGlass";
import { useAccentColor } from "../../state/theme/useAccentColor";

type NewChatModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectProfile: (profile: UserSearchResult) => void;
};

function ProfileItem({
  item,
  onSelect,
  isDark,
}: {
  item: UserSearchResult;
  onSelect: (profile: UserSearchResult) => void;
  isDark: boolean;
}) {
  const profilePic = item.extraData?.LargeProfilePicURL;
  const avatarUrl = profilePic
    ? `https://node.deso.org/api/v0/get-single-profile-picture/${item.publicKey}?fallback=${encodeURIComponent(profilePic)}`
    : buildProfilePictureUrl(item.publicKey, {
        fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
      });

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3"
      activeOpacity={0.7}
      onPress={() => onSelect(item)}
    >
      <Image
        source={{ uri: avatarUrl }}
        className="h-12 w-12 rounded-full bg-gray-200 dark:bg-slate-700"
      />
      <View className="ml-3 flex-1">
        <Text className="text-base font-semibold text-slate-900 dark:text-white">
          @{item.username}
        </Text>
        <Text
          className="text-sm text-slate-500 dark:text-slate-400"
          numberOfLines={1}
        >
          {item.publicKey.slice(0, 8)}...{item.publicKey.slice(-6)}
        </Text>
      </View>
      <Feather
        name="message-circle"
        size={20}
        color={isDark ? "#64748b" : "#94a3b8"}
      />
    </TouchableOpacity>
  );
}

function EmptyState({
  isLoading,
  hasSearched,
  isDark,
  accentColor,
  accentSoft,
}: {
  isLoading: boolean;
  hasSearched: boolean;
  isDark: boolean;
  accentColor: string;
  accentSoft: string;
}) {
  if (isLoading) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator color={accentColor} size="large" />
        <Text className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Searching...
        </Text>
      </View>
    );
  }

  if (!hasSearched) {
    return (
      <View className="items-center py-12 px-6">
        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: accentSoft }}
        >
          <Feather
            name="search"
            size={28}
            color={accentColor}
          />
        </View>
        <Text className="mt-4 text-center text-base font-medium text-slate-700 dark:text-slate-300">
          Find someone to chat with
        </Text>
        <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
          Search by username to start a conversation
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center py-12 px-6">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Feather
          name="user-x"
          size={28}
          color={isDark ? "#64748b" : "#94a3b8"}
        />
      </View>
      <Text className="mt-4 text-center text-base font-medium text-slate-700 dark:text-slate-300">
        No users found
      </Text>
      <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
        Try a different username
      </Text>
    </View>
  );
}

export default function NewChatModal({
  visible,
  onClose,
  onSelectProfile,
}: NewChatModalProps) {
  const { isDark, accentColor, accentSoft } = useAccentColor();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { currentUser } = useContext(DeSoIdentityContext);
  const [isClosing, setIsClosing] = useState(false);
  const sheetTranslateY = useSharedValue(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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
        const profiles = await searchUsers(searchQuery);
        // Filter out current user from results
        const filtered = profiles.filter(
          (p) => p.publicKey !== currentUser?.PublicKeyBase58Check
        );
        setResults(filtered);
      } catch (error) {
        console.error("[NewChatModal] search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentUser?.PublicKeyBase58Check]);

  // Focus input when modal opens
  useEffect(() => {
    if (visible) {
      // Reset sheet position when opening
      sheetTranslateY.value = 0;
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery("");
      setResults([]);
      setHasSearched(false);
    }
  }, [visible]);

  const handleSelectProfile = useCallback(
    (profile: UserSearchResult) => {
      Keyboard.dismiss();
      onSelectProfile(profile);
      onClose();
    },
    [onSelectProfile, onClose]
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Allow dragging down with some resistance
      if (e.translationY > 0) {
        // Add rubber banding effect for smoother feel
        sheetTranslateY.value = e.translationY * 0.85;
      }
    })
    .onEnd((e) => {
      // Close if dragged down enough or with sufficient velocity
      const shouldClose = e.translationY > 100 || e.velocityY > 500;
      if (shouldClose) {
        // Animate out smoothly before closing
        sheetTranslateY.value = withSpring(
          500, 
          { damping: 25, stiffness: 300, velocity: e.velocityY },
          (finished) => {
            if (finished) {
              runOnJS(handleClose)();
            }
          }
        );
      } else {
        // Snap back with smooth animation
        sheetTranslateY.value = withSpring(0, { 
          damping: 20, 
          stiffness: 400,
          mass: 0.8,
        });
      }
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View className="flex-1">
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="absolute inset-0"
        >
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={handleClose}
          >
            <BlurView
              intensity={Platform.OS === "ios" ? 40 : 100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Modal Content */}
        {!isClosing && (
          <Animated.View
            entering={SlideInDown.duration(280)}
            exiting={SlideOutDown.duration(250)}
            className="absolute bottom-0 left-0 right-0 overflow-hidden bg-white dark:bg-[#0a0f1a]"
            style={[
              {
                height: Dimensions.get('window').height - insets.top - 20,
                paddingBottom: insets.bottom,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: isDark ? 0.3 : 0.1,
                shadowRadius: 20,
                elevation: 20,
              },
              sheetAnimatedStyle,
            ]}
          >
            {/* Swipeable Header Area */}
            <GestureDetector gesture={panGesture}>
              <View>
                {/* Drag Handle */}
                <View className="items-center pt-4 pb-3">
                  <View 
                    className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" 
                  />
                </View>

                {/* Header */}
                <View className="flex-row items-center justify-between px-4 pb-4">
                  <Text className="text-lg font-semibold text-slate-900 dark:text-white">
                    New Message
                  </Text>
                  <TouchableOpacity
                    onPress={handleClose}
                    activeOpacity={0.7}
                  >
                    {LiquidGlassView ? (
                      <LiquidGlassView
                        effect="regular"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather
                          name="x"
                          size={16}
                          color={isDark ? "#fff" : "#000"}
                        />
                      </LiquidGlassView>
                    ) : (
                      <BlurView
                        intensity={Platform.OS === "ios" ? 60 : 100}
                        tint={isDark ? "dark" : "light"}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <Feather
                          name="x"
                          size={16}
                          color={isDark ? "#94a3b8" : "#64748b"}
                        />
                      </BlurView>
                    )}
                  </TouchableOpacity>
                </View>
                
                {/* Separator */}
                <View className="border-b border-slate-100 dark:border-slate-800" />
              </View>
            </GestureDetector>

          {/* Search Input */}
          <View className="px-4 py-3">
            <View className="h-12 flex-row items-center rounded-xl bg-slate-100 px-3 dark:bg-slate-800">
              <Feather
                name="search"
                size={18}
                color={isDark ? "#64748b" : "#94a3b8"}
              />
              <TextInput
                ref={inputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search username..."
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                className="ml-3 flex-1 text-base leading-5 text-slate-900 dark:text-white"
                style={{
                  paddingVertical: 0,
                  paddingTop: 0,
                  paddingBottom: 0,
                  includeFontPadding: false,
                  textAlignVertical: "center",
                  height: 40,
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Results */}
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
            ListEmptyComponent={
              <EmptyState
                isLoading={isLoading}
                hasSearched={hasSearched}
                isDark={isDark}
                accentColor={accentColor}
                accentSoft={accentSoft}
              />
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          />
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
