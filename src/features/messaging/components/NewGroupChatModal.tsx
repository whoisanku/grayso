import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    Alert,
    Platform,
    Keyboard,
    KeyboardAvoidingView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { DeSoIdentityContext } from 'react-deso-protocol';
import { searchUsers, UserSearchResult } from '@/lib/userSearch';
import { createGroupChat } from '@/features/messaging/api/groupChat';
import { FALLBACK_PROFILE_IMAGE, getProfileImageUrl } from '@/utils/deso';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/media';
import { useAccentColor } from '@/state/theme/useAccentColor';
import { DesktopLeftNav } from './desktop/DesktopLeftNav';
import { DesktopRightNav } from './desktop/DesktopRightNav';
import { CENTER_CONTENT_MAX_WIDTH, useLayoutBreakpoints } from '@/alf/breakpoints';
import UserGroupIcon from '@/assets/navIcons/user-group.svg';

const DEFAULT_IMAGE_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

interface NewGroupChatModalProps {
    visible: boolean;
    onClose: () => void;
    onGroupCreated: () => void;
    onNavigateToGroup: (groupName: string, ownerPublicKey: string, initialMessage: string) => void;
}

export function NewGroupChatModal({ visible, onClose, onGroupCreated, onNavigateToGroup }: NewGroupChatModalProps) {
    const { isDark, accentColor, accentStrong, accentSoft, accentSurface, onAccent } = useAccentColor();
    const { currentUser } = useContext(DeSoIdentityContext);
    const { isDesktop } = useLayoutBreakpoints();

    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [groupImageUri, setGroupImageUri] = useState<string | null>(null);
    const [groupImageUrl, setGroupImageUrl] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    // Check if we're on web desktop to show sidebars
    const isWebDesktop = Platform.OS === 'web' && isDesktop;

    // Track keyboard visibility for conditional rendering
    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setIsKeyboardVisible(true)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setIsKeyboardVisible(false)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setGroupName('');
            setSearchQuery('');
            setSearchResults([]);
            setSelectedMembers([]);
            setGroupImageUri(null);
            setGroupImageUrl(null);
            setIsKeyboardVisible(false);
        }
    }, [visible]);

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
        setSearchQuery('');
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

    const isFormValid = groupName.trim() && selectedMembers.length > 0 && !isCreating;

    // Main content that's shared between mobile and desktop
    const renderContent = () => (
        <>
            {/* Header */}
            <View
                className="flex-row items-center justify-between border-b px-5 py-4"
                style={{
                    borderBottomColor: isDark
                        ? 'rgba(51, 65, 85, 0.5)'
                        : 'rgba(226, 232, 240, 0.8)',
                }}
            >
                <Text
                    className="text-[22px] font-extrabold"
                    style={{
                        color: isDark ? '#ffffff' : '#0f172a',
                        letterSpacing: -0.5,
                    }}
                >
                    New Group Chat
                </Text>
                <TouchableOpacity
                    onPress={onClose}
                    disabled={isCreating}
                    activeOpacity={0.7}
                    className="h-9 w-9 items-center justify-center rounded-full"
                    style={{
                        backgroundColor: isDark
                            ? 'rgba(51, 65, 85, 0.6)'
                            : 'rgba(241, 245, 249, 1)',
                    }}
                >
                    <Feather name="x" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </TouchableOpacity>
            </View>

            {/* Group Image & Name Section - Hidden when keyboard is visible */}
            {!isKeyboardVisible && (
            <View
                className="items-center border-b px-5 py-6"
                style={{
                    borderBottomColor: isDark
                        ? 'rgba(51, 65, 85, 0.3)'
                        : 'rgba(241, 245, 249, 0.8)',
                }}
            >
                {/* Group Image Picker with Glow Effect */}
                <TouchableOpacity
                    onPress={handlePickImage}
                    activeOpacity={0.8}
                    disabled={isCreating || isUploadingImage}
                    className="mb-5"
                >
                    <View className="relative">
                        {/* Glow effect when image is selected */}
                        {groupImageUri && (
                            <View
                                className="absolute -inset-1 rounded-[52px]"
                                style={{
                                    backgroundColor: accentColor,
                                    opacity: 0.3,
                                    ...(Platform.OS === 'ios' && {
                                        shadowColor: accentColor,
                                        shadowOffset: { width: 0, height: 0 },
                                        shadowOpacity: 0.5,
                                        shadowRadius: 20,
                                    }),
                                }}
                            />
                        )}
                        {groupImageUri ? (
                            <Image
                                source={{ uri: groupImageUri }}
                                className="h-24 w-24 rounded-full border-[3px]"
                                style={{ borderColor: accentColor }}
                                placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
                                transition={500}
                            />
                        ) : (
                            <View
                                className="h-24 w-24 items-center justify-center rounded-full border-2 border-dashed"
                                style={{
                                    backgroundColor: isDark
                                        ? 'rgba(51, 65, 85, 0.5)'
                                        : 'rgba(241, 245, 249, 1)',
                                    borderColor: isDark
                                        ? 'rgba(71, 85, 105, 0.5)'
                                        : 'rgba(203, 213, 225, 0.8)',
                                }}
                            >
                                <Feather name="camera" size={32} color={isDark ? "#64748b" : "#94a3b8"} />
                                <Text
                                    className="mt-1 text-[11px] font-semibold"
                                    style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                                >
                                    Add Photo
                                </Text>
                            </View>
                        )}
                        {isUploadingImage && (
                            <View className="absolute inset-0 h-24 w-24 items-center justify-center rounded-full bg-black/60">
                                <ActivityIndicator color="white" size="small" />
                            </View>
                        )}
                        {/* Edit badge */}
                        {groupImageUri && !isUploadingImage && (
                            <View
                                className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full border-2"
                                style={{
                                    backgroundColor: accentColor,
                                    borderColor: isDark ? '#0a0f1a' : '#ffffff',
                                }}
                            >
                                <Feather name="edit-2" size={12} color="#ffffff" />
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Group Name Input */}
                <View className="w-full max-w-[300px]">
                    <TextInput
                        className="rounded-2xl border px-4 py-3 text-center text-[20px] font-bold"
                        style={[
                            {
                                color: isDark ? '#ffffff' : '#0f172a',
                                backgroundColor: isDark
                                    ? 'rgba(51, 65, 85, 0.3)'
                                    : 'rgba(241, 245, 249, 0.8)',
                                borderColor: isDark
                                    ? 'rgba(71, 85, 105, 0.4)'
                                    : 'rgba(203, 213, 225, 0.6)',
                            },
                            Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null,
                        ]}
                        placeholder="Enter group name"
                        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                        value={groupName}
                        onChangeText={setGroupName}
                        autoCapitalize="words"
                        editable={!isCreating}
                    />
                </View>
            </View>
            )}

            {/* Search Section */}
            <View className="px-4 pt-4 pb-3">
                <View
                    className="h-[50px] flex-row items-center rounded-[14px] border px-4"
                    style={{
                        backgroundColor: isDark
                            ? 'rgba(51, 65, 85, 0.4)'
                            : 'rgba(241, 245, 249, 1)',
                        borderColor: isDark
                            ? 'rgba(71, 85, 105, 0.3)'
                            : 'rgba(203, 213, 225, 0.5)',
                    }}
                >
                    <Feather name="search" size={18} color={isDark ? "#64748b" : "#94a3b8"} />
                    <TextInput
                        className="ml-3 flex-1 text-base"
                        style={[
                            {
                                color: isDark ? '#ffffff' : '#0f172a',
                            },
                            Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null,
                        ]}
                        placeholder="Search username..."
                        placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isCreating}
                    />
                    {isSearching && <ActivityIndicator size="small" color={accentColor} />}
                </View>
            </View>

            {/* Selected Members - Wrapping Chips */}
            {selectedMembers.length > 0 && (
                <View
                    className="max-h-[140px] border-b"
                    style={{
                        borderBottomColor: isDark
                            ? 'rgba(51, 65, 85, 0.3)'
                            : 'rgba(241, 245, 249, 0.8)',
                    }}
                >
                    <View className="flex-row items-center px-4 pt-3 pb-2">
                    <View
                        className="rounded-lg px-2.5 py-1"
                        style={{ backgroundColor: accentSoft }}
                    >
                        <Text className="text-[12px] font-bold" style={{ color: accentStrong }}>
                            {selectedMembers.length} {selectedMembers.length === 1 ? 'member' : 'members'}
                        </Text>
                    </View>
                </View>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerClassName="flex-row flex-wrap gap-2 px-4 pb-3"
                >
                    {selectedMembers.map((member) => (
                        <View
                            key={member.publicKey}
                            className="flex-row items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1"
                            style={{
                                backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 1)',
                                borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(203, 213, 225, 0.6)',
                            }}
                        >
                            <Image
                                source={{ uri: getProfileImageUrl(member.publicKey) || FALLBACK_PROFILE_IMAGE }}
                                className="h-7 w-7 rounded-full"
                                placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
                                transition={500}
                            />
                            <Text
                                className="max-w-[100px] text-[13px] font-semibold"
                                style={{ color: isDark ? '#ffffff' : '#0f172a' }}
                                numberOfLines={1}
                            >
                                {member.username}
                            </Text>
                            <TouchableOpacity
                                onPress={() => handleRemoveMember(member.publicKey)}
                                disabled={isCreating}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                className="h-[18px] w-[18px] items-center justify-center rounded-full"
                                style={{
                                    backgroundColor: isDark
                                        ? 'rgba(71, 85, 105, 0.8)'
                                        : 'rgba(203, 213, 225, 0.8)',
                                }}
                            >
                                <Feather name="x" size={10} color={isDark ? "#94a3b8" : "#64748b"} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            </View>
            )}

            {/* Search Results */}
            <FlashList
                data={searchResults}
                keyExtractor={(item) => item.publicKey}
                keyboardShouldPersistTaps="handled"
                className="flex-1"
                contentContainerClassName="pb-5"
                ListEmptyComponent={
                    searchQuery.trim().length > 0 && !isSearching ? (
                        <View className="items-center justify-center px-6 py-10">
                            <View
                                className="mb-4 h-16 w-16 items-center justify-center rounded-full"
                                style={{
                                    backgroundColor: isDark
                                        ? 'rgba(51, 65, 85, 0.4)'
                                        : 'rgba(241, 245, 249, 1)',
                                }}
                            >
                                <UserGroupIcon width={28} height={28} stroke={isDark ? "#64748b" : "#94a3b8"} strokeWidth={2} />
                            </View>
                            <Text
                                className="text-base font-semibold text-center"
                                style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                            >
                                No users found
                            </Text>
                            <Text
                                className="mt-1 text-sm text-center"
                                style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                            >
                                Try a different username
                            </Text>
                        </View>
                    ) : searchQuery.trim().length === 0 && selectedMembers.length === 0 ? (
                        <View className="items-center justify-center px-6 py-10">
                            <View
                                className="mb-4 h-16 w-16 items-center justify-center rounded-full"
                                style={{ backgroundColor: accentSoft }}
                            >
                                <Feather name="user-plus" size={28} color={accentStrong} />
                            </View>
                            <Text
                                className="text-base font-semibold text-center"
                                style={{ color: isDark ? '#e2e8f0' : '#334155' }}
                            >
                                Add members to your group
                            </Text>
                            <Text
                                className="mt-1 text-sm text-center"
                                style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                            >
                                Search for users by their username
                            </Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => handleSelectMember(item)}
                        activeOpacity={0.7}
                        disabled={isCreating}
                        className="flex-row items-center px-5 py-3"
                    >
                        <Image
                            source={{ uri: getProfileImageUrl(item.publicKey) || FALLBACK_PROFILE_IMAGE }}
                            className="mr-3.5 h-12 w-12 rounded-full"
                            style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}
                            placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
                            transition={500}
                        />
                        <View className="flex-1">
                            <Text
                                className="text-base font-semibold"
                                style={{ color: isDark ? '#ffffff' : '#0f172a' }}
                            >
                                {item.username}
                            </Text>
                            {item.extraData?.DisplayName && (
                                <Text
                                    className="mt-0.5 text-sm"
                                    style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                                >
                                    {item.extraData.DisplayName}
                                </Text>
                            )}
                        </View>
                        <View
                            className="h-8 w-8 items-center justify-center rounded-full"
                            style={{ backgroundColor: accentSoft }}
                        >
                            <Feather name="plus" size={16} color={accentStrong} />
                        </View>
                    </TouchableOpacity>
                )}
            />

            {/* Create Button */}
            <View
                className="border-t px-4 py-4"
                style={{
                    borderTopColor: isDark
                        ? 'rgba(51, 65, 85, 0.4)'
                        : 'rgba(241, 245, 249, 0.8)',
                    backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
                }}
            >
                <TouchableOpacity
                    onPress={handleCreate}
                    disabled={!isFormValid}
                    activeOpacity={0.8}
                    className="w-full items-center justify-center rounded-2xl py-4"
                    style={{
                        backgroundColor: isFormValid
                            ? accentColor
                            : (isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(241, 245, 249, 1)'),
                        ...(isFormValid && Platform.OS === 'ios' && {
                            shadowColor: accentColor,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                        }),
                    }}
                >
                    {isCreating ? (
                        <ActivityIndicator color={isFormValid ? onAccent : (isDark ? "#64748b" : "#94a3b8")} />
                    ) : (
                        <View className="flex-row items-center gap-2">
                            <UserGroupIcon
                                width={18}
                                height={18}
                                stroke={isFormValid ? onAccent : (isDark ? "#64748b" : "#94a3b8")}
                                strokeWidth={2}
                            />
                            <Text
                                className="text-base font-bold"
                                style={{ color: isFormValid ? onAccent : (isDark ? "#64748b" : "#94a3b8") }}
                            >
                                Create Group
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        </>
    );

    return (
        <Modal
            visible={visible}
            animationType={isWebDesktop ? "fade" : "slide"}
            presentationStyle={isWebDesktop ? "overFullScreen" : "pageSheet"}
            transparent={isWebDesktop}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {isWebDesktop ? (
                    // Desktop: Show with sidebars visible
                    <View
                        className="flex-1"
                        style={{
                            backgroundColor: isDark
                                ? 'rgba(10, 15, 26, 0.85)'
                                : 'rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        {/* Left sidebar */}
                        <DesktopLeftNav />
                        
                        {/* Center content area */}
                        <View className="flex-1 items-center">
                            <View
                                className="flex-1 w-full"
                                style={{
                                    maxWidth: CENTER_CONTENT_MAX_WIDTH,
                                    backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
                                    borderLeftWidth: 1,
                                    borderRightWidth: 1,
                                    borderColor: isDark
                                        ? 'rgba(148, 163, 184, 0.15)'
                                        : 'rgba(148, 163, 184, 0.25)',
                                }}
                            >
                                {renderContent()}
                            </View>
                        </View>
                        
                        {/* Right sidebar */}
                        <DesktopRightNav />
                    </View>
                ) : (
                    // Mobile: Standard page sheet
                    <SafeAreaView
                        className="flex-1"
                        style={{ backgroundColor: isDark ? '#0a0f1a' : '#ffffff' }}
                    >
                        {renderContent()}
                    </SafeAreaView>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}
