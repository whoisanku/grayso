import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { DeSoIdentityContext } from 'react-deso-protocol';
import { searchUsers, UserSearchResult } from '../../services/userSearch';
import { createGroupChat } from '../../services/groupChat';
import { FALLBACK_PROFILE_IMAGE, getProfileImageUrl } from '../../utils/deso';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../services/media';

interface NewGroupChatModalProps {
    visible: boolean;
    onClose: () => void;
    onGroupCreated: () => void;
    onNavigateToGroup: (groupName: string, ownerPublicKey: string, initialMessage: string) => void;
}

export function NewGroupChatModal({ visible, onClose, onGroupCreated, onNavigateToGroup }: NewGroupChatModalProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { currentUser } = useContext(DeSoIdentityContext);

    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [groupImageUri, setGroupImageUri] = useState<string | null>(null);
    const [groupImageUrl, setGroupImageUrl] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsSearching(true);
            try {
                const results = await searchUsers(searchQuery);
                // Filter out already selected members
                const filtered = results.filter(
                    r => !selectedMembers.some(m => m.publicKey === r.publicKey)
                );
                setSearchResults(filtered);
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, selectedMembers]);

    const handleSelectMember = (user: UserSearchResult) => {
        setSelectedMembers(prev => [...prev, user]);
        setSearchResults(prev => prev.filter(u => u.publicKey !== user.publicKey));
        setSearchQuery(''); // Optional: clear search after selection
    };

    const handleRemoveMember = (publicKey: string) => {
        setSelectedMembers(prev => prev.filter(m => m.publicKey !== publicKey));
    };

    const handlePickImage = async () => {
        if (!currentUser?.PublicKeyBase58Check) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            const imageUri = result.assets[0].uri;
            setGroupImageUri(imageUri);

            // Upload image immediately
            setIsUploadingImage(true);
            try {
                const uploadedUrl = await uploadImage(currentUser.PublicKeyBase58Check, imageUri);
                setGroupImageUrl(uploadedUrl);
            } catch (error) {
                console.error('Failed to upload group image:', error);
                Alert.alert('Error', 'Failed to upload image. Please try again.');
                setGroupImageUri(null);
            } finally {
                setIsUploadingImage(false);
            }
        }
    };

    const handleCreate = async () => {
        if (!groupName.trim() || selectedMembers.length === 0 || !currentUser?.PublicKeyBase58Check) return;

        setIsCreating(true);
        const initialMessage = `Hi. This is my first message to "${groupName.trim()}"`;

        try {
            await createGroupChat(
                groupName.trim(),
                selectedMembers.map(m => m.publicKey),
                currentUser.PublicKeyBase58Check,
                groupImageUrl || undefined
            );

            // Navigate to the newly created group with initial message
            onNavigateToGroup(groupName.trim(), currentUser.PublicKeyBase58Check, initialMessage);

            // Reset state
            setGroupName('');
            setSelectedMembers([]);
            setSearchQuery('');
            setGroupImageUri(null);
            setGroupImageUrl(null);
            onClose();
        } catch (error) {
            console.error('Failed to create group:', error);
            Alert.alert('Error', 'Failed to create group chat. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1 bg-white dark:bg-[#0a0f1a]">
                {/* Header */}
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
                    <Text className="text-xl font-bold text-[#111] dark:text-white">New Group Chat</Text>
                    <TouchableOpacity onPress={onClose} className="p-1" disabled={isCreating}>
                        <Feather name="x" size={24} color={isDark ? "#fff" : "#111"} />
                    </TouchableOpacity>
                </View>


                {/* Group Details */}
                <View className="px-5 py-4 flex-row items-center border-b border-gray-100 dark:border-slate-800">
                    <TouchableOpacity
                        onPress={handlePickImage}
                        activeOpacity={0.7}
                        className="mr-4 relative"
                        disabled={isCreating || isUploadingImage}
                    >
                        {groupImageUri ? (
                            <>
                                <Image
                                    source={{ uri: groupImageUri }}
                                    className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700"
                                />
                                {isUploadingImage && (
                                    <View className="absolute inset-0 h-16 w-16 rounded-full bg-black/50 items-center justify-center">
                                        <ActivityIndicator color="white" size="small" />
                                    </View>
                                )}
                            </>
                        ) : (
                            <View className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center">
                                <Feather name="camera" size={24} color={isDark ? "#64748b" : "#94a3b8"} />
                            </View>
                        )}
                    </TouchableOpacity>
                    <View className="flex-1">
                        <TextInput
                            className="text-lg font-semibold text-slate-900 dark:text-white"
                            placeholder="Group name"
                            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                            value={groupName}
                            onChangeText={setGroupName}
                            autoCapitalize="words"
                            editable={!isCreating}
                        />
                    </View>
                </View>

                {/* Search Input */}
                <View className="px-4 py-3">
                    <View className="h-12 flex-row items-center rounded-xl bg-slate-100 px-4 dark:bg-slate-800">
                        <Feather name="search" size={18} color={isDark ? "#64748b" : "#94a3b8"} />
                        <TextInput
                            className="ml-3 flex-1 text-base text-slate-900 dark:text-white"
                            placeholder="Search username..."
                            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isCreating}
                        />
                        {isSearching && <ActivityIndicator size="small" color="#0085ff" />}
                    </View>
                </View>

                {/* Selected Members */}
                {selectedMembers.length > 0 && (
                    <View className="px-5 pb-3">
                        <Text className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Selected Members ({selectedMembers.length})
                        </Text>
                        <View className="gap-2">
                            {selectedMembers.map((member) => (
                                <View
                                    key={member.publicKey}
                                    className="flex-row items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-900"
                                >
                                    <View className="flex-row items-center flex-1">
                                        <Image
                                            source={{ uri: getProfileImageUrl(member.publicKey) || FALLBACK_PROFILE_IMAGE }}
                                            className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 mr-3"
                                        />
                                        <View className="flex-1">
                                            <Text className="text-base font-semibold text-slate-900 dark:text-white">
                                                {member.username}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveMember(member.publicKey)}
                                        className="h-8 w-8 items-center justify-center rounded-full bg-blue-500"
                                        disabled={isCreating}
                                    >
                                        <Feather name="check" size={16} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Search Results */}
                <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.publicKey}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => handleSelectMember(item)}
                            className="flex-row items-center px-5 py-3 active:bg-slate-50 dark:active:bg-slate-900"
                            disabled={isCreating}
                        >
                            <Image
                                source={{ uri: getProfileImageUrl(item.publicKey) || FALLBACK_PROFILE_IMAGE }}
                                className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 mr-3"
                            />
                            <View>
                                <Text className="text-base font-semibold text-slate-900 dark:text-white">
                                    {item.username}
                                </Text>
                                {item.extraData?.DisplayName && (
                                    <Text className="text-sm text-slate-500 dark:text-slate-400">
                                        {item.extraData.DisplayName}
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    )}
                />

                {/* Create Button */}
                <View className="p-4 border-t border-gray-100 dark:border-slate-800">
                    <TouchableOpacity
                        onPress={handleCreate}
                        disabled={!groupName.trim() || selectedMembers.length === 0 || isCreating}
                        className={`w-full rounded-xl py-4 items-center ${!groupName.trim() || selectedMembers.length === 0 || isCreating
                            ? 'bg-slate-100 dark:bg-slate-800'
                            : 'bg-[#0085ff]'
                            }`}
                    >
                        {isCreating ? (
                            <ActivityIndicator color={!groupName.trim() || selectedMembers.length === 0 ? "#94a3b8" : "white"} />
                        ) : (
                            <Text
                                className={`text-base font-bold ${!groupName.trim() || selectedMembers.length === 0
                                    ? 'text-slate-400 dark:text-slate-500'
                                    : 'text-white'
                                    }`}
                            >
                                Create Group
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal >
    );
}
