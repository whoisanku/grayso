import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Animated,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "../navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { DeSoIdentityContext } from "react-deso-protocol";
import { fetchFollowingViaGraphql } from "../services/desoGraphql";
import { hexToDataUrl } from "../utils/hex";
import { FALLBACK_PROFILE_IMAGE, getProfileImageUrl } from "../utils/deso";
import { ChatType } from "deso-protocol";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { encryptAndSendNewMessage } from "../services/conversations";
import { DEFAULT_KEY_MESSAGING_GROUP_NAME } from "../services/conversations";

type ComposerScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Composer">;
};

type Follower = {
  username?: string | null;
  profilePic?: string | null;
  publicKey: string;
};

export default function NewMessageComposer({ navigation }: ComposerScreenProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { currentUser } = useContext(DeSoIdentityContext);

  const [searchText, setSearchText] = useState("");
  const [following, setFollowing] = useState<Follower[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState<{ hasNextPage: boolean; endCursor: string | null }>({
    hasNextPage: false,
    endCursor: null,
  });

  const [selectedUser, setSelectedUser] = useState<Follower | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const loadFollowing = useCallback(async (cursor: string | null = null) => {
    if (!currentUser?.PublicKeyBase58Check) return;
    
    setIsLoading(true);
    try {
      const result = await fetchFollowingViaGraphql({
        publicKey: currentUser.PublicKeyBase58Check,
        limit: 20,
        afterCursor: cursor,
      });

      setFollowing(prev => cursor ? [...prev, ...result.following] : result.following);
      setPageInfo(result.pageInfo);
    } catch (error) {
      console.error("Failed to fetch following:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.PublicKeyBase58Check]);

  useEffect(() => {
    loadFollowing();
  }, [loadFollowing]);

  const handleEndReached = () => {
    if (pageInfo.hasNextPage && pageInfo.endCursor && !isLoading) {
      loadFollowing(pageInfo.endCursor);
    }
  };

  const handleUserPress = (user: Follower) => {
    setSelectedUser(user);
    setSearchText("");
  };

  const handleRemoveUser = () => {
    setSelectedUser(null);
    setSearchText("");
  };

  const handleSendMessage = async () => {
    if (!selectedUser || !messageText.trim() || !currentUser?.PublicKeyBase58Check || isSending) return;

    setIsSending(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await encryptAndSendNewMessage(
        messageText.trim(),
        currentUser.PublicKeyBase58Check,
        selectedUser.publicKey,
        DEFAULT_KEY_MESSAGING_GROUP_NAME,
        DEFAULT_KEY_MESSAGING_GROUP_NAME,
        undefined,
        {}
      );

      // Navigate to conversation
      navigation.replace("Conversation", {
        threadPublicKey: selectedUser.publicKey,
        chatType: ChatType.DM,
        userPublicKey: currentUser.PublicKeyBase58Check,
        title: selectedUser.username || "Chat",
      });

    } catch (error) {
      console.error("Failed to send message:", error);
      // Show error toast or alert
    } finally {
      setIsSending(false);
    }
  };

  const renderFollowerItem = ({ item }: { item: Follower }) => {
    // Decode profile pic if it is hex
    let avatarUrl = item.profilePic ? hexToDataUrl(item.profilePic) : null;
    if (!avatarUrl) {
        avatarUrl = getProfileImageUrl(item.publicKey) || FALLBACK_PROFILE_IMAGE;
    }

    return (
      <TouchableOpacity
        onPress={() => handleUserPress(item)}
        className="flex-row items-center px-4 py-3 active:bg-slate-50 dark:active:bg-slate-900"
      >
        <Image
          source={{ uri: avatarUrl }}
          className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800"
        />
        <View className="ml-3 flex-1">
          <Text className="font-bold text-slate-900 dark:text-white">
            {item.username || "Unknown"}
          </Text>
          <Text className="text-xs text-slate-500" numberOfLines={1}>{item.publicKey}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Styles from Bluesky Composer adapted
  const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: isDark ? "#000" : "#fff",
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? "#334155" : "#f1f5f9",
        paddingTop: Platform.OS === "android" ? insets.top + 10 : 12,
    },
    toContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: isDark ? "#334155" : "#e2e8f0",
    },
    toLabel: {
        fontSize: 16,
        color: isDark ? "#94a3b8" : "#64748b",
        marginRight: 8,
    },
    toInput: {
        flex: 1,
        fontSize: 16,
        color: isDark ? "#fff" : "#000",
        padding: 0,
    },
    selectedUserChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? "#1e293b" : "#e0f2fe",
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginRight: 8,
    },
    selectedUserText: {
        color: "#0284c7",
        fontWeight: "600",
        fontSize: 14,
        marginRight: 4,
    },
    composerArea: {
        flex: 1,
        padding: 16,
    },
    textInput: {
        fontSize: 18,
        lineHeight: 24,
        color: isDark ? "#fff" : "#000",
        minHeight: 100,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: isDark ? "#334155" : "#f1f5f9",
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    charCount: {
        fontSize: 12,
        color: isDark ? "#64748b" : "#94a3b8",
    },
    mediaButton: {
        padding: 8,
    }
  });

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
    >
        {/* Header */}
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text className="text-[17px] text-slate-600 dark:text-slate-400">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-[17px] font-bold text-slate-900 dark:text-white">New Message</Text>
            {selectedUser ? (
                <TouchableOpacity
                    onPress={handleSendMessage}
                    disabled={isSending || !messageText.trim()}
                    className={`rounded-full px-4 py-1.5 ${!messageText.trim() || isSending ? 'bg-blue-300 dark:bg-blue-900' : 'bg-blue-500'}`}
                >
                    {isSending ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Text className="font-bold text-white">Send</Text>
                    )}
                </TouchableOpacity>
            ) : (
                <View style={{ width: 60 }} />
            )}
        </View>

        {/* To Field */}
        <View style={styles.toContainer}>
            <Text style={styles.toLabel}>To:</Text>
            {selectedUser ? (
                <View style={styles.selectedUserChip}>
                    <Text style={styles.selectedUserText}>{selectedUser.username || selectedUser.publicKey.slice(0, 8)}</Text>
                    <TouchableOpacity onPress={handleRemoveUser}>
                        <Feather name="x" size={14} color="#0284c7" />
                    </TouchableOpacity>
                </View>
            ) : (
                <TextInput
                    autoFocus={!selectedUser}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Search people"
                    placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                    style={styles.toInput}
                />
            )}
        </View>

        {/* Content */}
        {selectedUser ? (
            <>
                <ScrollView style={styles.composerArea} keyboardShouldPersistTaps="always">
                    <TextInput
                        value={messageText}
                        onChangeText={setMessageText}
                        placeholder="Write your message..."
                        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                        multiline
                        style={styles.textInput}
                        autoFocus
                        textAlignVertical="top"
                    />
                </ScrollView>
                {/* Bluesky-like Footer */}
                <View style={styles.footer}>
                    <View style={styles.toolbar}>
                         <TouchableOpacity style={styles.mediaButton}>
                            <Feather name="image" size={24} color="#0085ff" />
                         </TouchableOpacity>
                         <TouchableOpacity style={styles.mediaButton}>
                            <Feather name="camera" size={24} color="#0085ff" />
                         </TouchableOpacity>
                         <TouchableOpacity style={styles.mediaButton}>
                            <Feather name="smile" size={24} color="#0085ff" />
                         </TouchableOpacity>
                    </View>
                    <Text style={styles.charCount}>{messageText.length} / 280</Text>
                </View>
            </>
        ) : (
            <FlatList
                data={useMemo(() => {
                    if (!searchText) return following;
                    return following.filter(item =>
                        item.username?.toLowerCase().includes(searchText.toLowerCase())
                    );
                }, [following, searchText])}
                renderItem={renderFollowerItem}
                keyExtractor={(item) => item.publicKey}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={
                    isLoading ? (
                        <View className="py-4">
                            <ActivityIndicator />
                        </View>
                    ) : null
                }
            />
        )}
    </KeyboardAvoidingView>
  );
}
