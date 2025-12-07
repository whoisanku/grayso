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
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { buildProfilePictureUrl } from "deso-protocol";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { LiquidGlassView } from "../../utils/liquidGlass";
import {
  searchProfiles,
  ProfileSearchResult,
} from "../../services/desoGraphql";
import { FALLBACK_PROFILE_IMAGE, formatPublicKey } from "../../utils/deso";
import { RootStackParamList } from "../../navigation/types";
import { createGroupChat } from "../../services/conversations";
import { uploadImage } from "../../services/media";

type CreateGroupChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

function MemberItem({
  item,
  onRemove,
  isDark,
}: {
  item: ProfileSearchResult;
  onRemove: (profile: ProfileSearchResult) => void;
  isDark: boolean;
}) {
  return (
    <View className="mr-2 mb-2 flex-row items-center rounded-full bg-slate-200 pl-1 pr-2 py-1 dark:bg-slate-700">
      <Image
        source={{
          uri: item.publicKey
            ? buildProfilePictureUrl(item.publicKey, {
                fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
              })
            : FALLBACK_PROFILE_IMAGE,
        }}
        className="h-6 w-6 rounded-full bg-slate-300 dark:bg-slate-600"
      />
      <Text className="ml-2 mr-1 text-sm font-medium text-slate-900 dark:text-white">
        {item.username || formatPublicKey(item.publicKey)}
      </Text>
      <TouchableOpacity onPress={() => onRemove(item)}>
        <Feather name="x" size={14} color={isDark ? "#94a3b8" : "#64748b"} />
      </TouchableOpacity>
    </View>
  );
}

function SearchResultItem({
  item,
  onSelect,
  isSelected,
  isDark,
}: {
  item: ProfileSearchResult;
  onSelect: (profile: ProfileSearchResult) => void;
  isSelected: boolean;
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
      disabled={isSelected}
    >
      <Image
        source={{ uri: avatarUrl }}
        className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700"
      />
      <View className="ml-3 flex-1">
        <Text
          className={`text-base font-semibold ${isSelected ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"}`}
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
      {isSelected && (
        <Feather name="check" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
      )}
    </TouchableOpacity>
  );
}

export default function CreateGroupChatScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { currentUser } = useContext(DeSoIdentityContext);
  const navigation = useNavigation<CreateGroupChatScreenNavigationProp>();

  const [groupName, setGroupName] = useState("");
  const [groupImageUri, setGroupImageUri] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<ProfileSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const inputRef = useRef<TextInput>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const profiles = await searchProfiles({ query: searchQuery, limit: 10 });
        const filtered = profiles.filter(
          (p) => p.publicKey !== currentUser?.PublicKeyBase58Check
        );
        setResults(filtered);
      } catch (error) {
        console.error("[CreateGroupChat] search error:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentUser?.PublicKeyBase58Check]);

  const handleSelectProfile = useCallback((profile: ProfileSearchResult) => {
    setSelectedMembers((prev) => {
      if (prev.find((p) => p.publicKey === profile.publicKey)) return prev;
      return [...prev, profile];
    });
    setSearchQuery(""); // Clear search after selection? Or keep it?
    // Maybe better to keep it if user wants to see what they typed, but standard is usually clear.
    // Let's clear it to allow next search easily.
    inputRef.current?.clear();
    setSearchQuery("");
  }, []);

  const handleRemoveMember = useCallback((profile: ProfileSearchResult) => {
    setSelectedMembers((prev) => prev.filter((p) => p.publicKey !== profile.publicKey));
  }, []);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].uri) {
      setGroupImageUri(result.assets[0].uri);
    }
  };

  const handleCreateGroup = async () => {
    if (!currentUser?.PublicKeyBase58Check) return;
    if (!groupName.trim()) {
      Alert.alert("Missing Name", "Please enter a group name.");
      return;
    }
    if (selectedMembers.length === 0) {
      Alert.alert("No Members", "Please add at least one member.");
      return;
    }

    setIsCreating(true);
    try {
      let uploadedImageUrl = "";
      if (groupImageUri) {
        uploadedImageUrl = await uploadImage(currentUser.PublicKeyBase58Check, groupImageUri);
      }

      const memberKeys = selectedMembers.map((m) => m.publicKey);

      const { accessGroupKeyName } = await createGroupChat(
        currentUser.PublicKeyBase58Check,
        groupName.trim(),
        memberKeys,
        uploadedImageUrl
      );

      // Navigate to the new conversation
      navigation.replace("Conversation", {
        threadPublicKey: currentUser.PublicKeyBase58Check, // For group, thread PK is usually self or not used strictly same way
        chatType: "GROUPCHAT" as any,
        userPublicKey: currentUser.PublicKeyBase58Check,
        threadAccessGroupKeyName: accessGroupKeyName,
        userAccessGroupKeyName: "default-key", // The user's sending key
        title: groupName,
        recipientInfo: {
            AccessGroupKeyName: accessGroupKeyName,
            OwnerPublicKeyBase58Check: currentUser.PublicKeyBase58Check, // Group owner
        }
      });

    } catch (error) {
      console.error("Failed to create group:", error);
      Alert.alert("Error", "Failed to create group chat. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <View
      className="flex-1 bg-white dark:bg-[#0a0f1a]"
      style={{ paddingTop: Platform.OS === "android" ? insets.top : 0 }}
    >
      {/* Header */}
      <View className="items-center pt-3 pb-2">
        <View className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
      </View>

      <View className="flex-row items-center justify-between px-4 pb-4">
        <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
          <Text className="text-base text-slate-500 dark:text-slate-400">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-slate-900 dark:text-white">
          New Group
        </Text>
        <TouchableOpacity
            onPress={handleCreateGroup}
            disabled={isCreating || !groupName.trim() || selectedMembers.length === 0}
            activeOpacity={0.7}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#0085ff" />
          ) : (
            <Text className={`text-base font-bold ${(!groupName.trim() || selectedMembers.length === 0) ? "text-slate-300 dark:text-slate-600" : "text-[#0085ff]"}`}>
              Create
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-4">
        {/* Group Info Section */}
        <View className="flex-row items-center py-4 border-b border-slate-100 dark:border-slate-800">
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {groupImageUri ? (
                        <Image source={{ uri: groupImageUri }} className="h-full w-full" />
                    ) : (
                        <Feather name="camera" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                    )}
                </View>
            </TouchableOpacity>

            <TextInput
                className="ml-4 flex-1 text-lg font-medium text-slate-900 dark:text-white"
                placeholder="Group Name"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={groupName}
                onChangeText={setGroupName}
            />
        </View>

        {/* Selected Members */}
        {selectedMembers.length > 0 && (
            <View className="flex-row flex-wrap py-2">
                {selectedMembers.map((m) => (
                    <MemberItem key={m.publicKey} item={m} onRemove={handleRemoveMember} isDark={isDark} />
                ))}
            </View>
        )}

        {/* Search Input */}
        <View className="mt-2 h-10 flex-row items-center rounded-xl bg-slate-100 px-3 dark:bg-slate-800">
          <Feather
            name="search"
            size={16}
            color={isDark ? "#64748b" : "#94a3b8"}
          />
          <TextInput
            ref={inputRef}
            className="ml-2 flex-1 text-base text-slate-900 dark:text-white"
            placeholder="Search people..."
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        {/* Search Results */}
        <FlatList
          data={results}
          keyExtractor={(item) => item.publicKey}
          renderItem={({ item }) => (
            <SearchResultItem
              item={item}
              onSelect={handleSelectProfile}
              isSelected={!!selectedMembers.find((m) => m.publicKey === item.publicKey)}
              isDark={isDark}
            />
          )}
          contentContainerClassName="pt-2"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isSearching ? (
                <View className="py-4 items-center"><ActivityIndicator color="#0085ff" /></View>
            ) : searchQuery.trim() && results.length === 0 ? (
                <Text className="py-4 text-center text-slate-500">No users found</Text>
            ) : null
          }
        />
      </View>
    </View>
  );
}
