import React, { useState, useEffect, useCallback, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
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

type ComposerScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Composer">;
};

type Follower = {
  username?: string | null;
  profilePic?: string | null;
  publicKey: string;
};

export default function ComposerScreen({ navigation }: ComposerScreenProps) {
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
      navigation.navigate("Conversation", {
        threadPublicKey: user.publicKey,
        chatType: ChatType.DM,
        userPublicKey: currentUser?.PublicKeyBase58Check || "",
        title: user.username || "Chat",
      });
  };

  const renderItem = ({ item }: { item: Follower }) => {
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
          className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-800"
        />
        <View className="ml-3 flex-1">
          <Text className="font-bold text-slate-900 dark:text-white">
            {item.username || "Unknown"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
       <View
        style={{ paddingTop: Platform.OS === "android" ? insets.top + 10 : 10 }}
        className="border-b border-slate-100 bg-white px-4 pb-3 dark:border-slate-800 dark:bg-slate-950"
      >
        <View className="flex-row items-center justify-between mb-4">
             <TouchableOpacity onPress={() => navigation.goBack()}>
                 <Text className="text-lg text-slate-600 dark:text-slate-400">Cancel</Text>
             </TouchableOpacity>
             <Text className="text-lg font-bold text-slate-900 dark:text-white">New Chat</Text>
             <View style={{ width: 50 }} />
        </View>

        <View className="flex-row items-center rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-900">
           <Text className="text-slate-500 mr-2">To:</Text>
           <TextInput
             autoFocus
             value={searchText}
             onChangeText={setSearchText}
             placeholder="Search..."
             placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
             className="flex-1 text-base text-slate-900 dark:text-white"
           />
        </View>
      </View>

      <FlatList
        data={following}
        renderItem={renderItem}
        keyExtractor={(item) => item.publicKey}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
            isLoading ? (
                <View className="py-4">
                    <ActivityIndicator />
                </View>
            ) : null
        }
      />
    </View>
  );
}
