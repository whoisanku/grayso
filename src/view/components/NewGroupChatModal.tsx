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
    Platform,
    Keyboard,
    KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DeSoIdentityContext } from 'react-deso-protocol';
import { searchUsers, UserSearchResult } from '../../services/userSearch';
import { createGroupChat } from '../../services/groupChat';
import { FALLBACK_PROFILE_IMAGE, getProfileImageUrl } from '../../utils/deso';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../services/media';
import { useAccentColor } from '../../state/theme/useAccentColor';
import { DesktopLeftNav } from './desktop/DesktopLeftNav';
import { DesktopRightNav } from './desktop/DesktopRightNav';
import { CENTER_CONTENT_MAX_WIDTH, useLayoutBreakpoints } from '../../alf/breakpoints';

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
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
            }}>
                <Text style={{
                    fontSize: 22,
                    fontWeight: '800',
                    color: isDark ? '#ffffff' : '#0f172a',
                    letterSpacing: -0.5,
                }}>
                    New Group Chat
                </Text>
                <TouchableOpacity
                    onPress={onClose}
                    disabled={isCreating}
                    activeOpacity={0.7}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(241, 245, 249, 1)',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Feather name="x" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                </TouchableOpacity>
            </View>

            {/* Group Image & Name Section - Hidden when keyboard is visible */}
            {!isKeyboardVisible && (
            <View style={{
                paddingHorizontal: 20,
                paddingVertical: 24,
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 0.8)',
            }}>
                {/* Group Image Picker with Glow Effect */}
                <TouchableOpacity
                    onPress={handlePickImage}
                    activeOpacity={0.8}
                    disabled={isCreating || isUploadingImage}
                    style={{
                        marginBottom: 20,
                    }}
                >
                    <View style={{
                        position: 'relative',
                    }}>
                        {/* Glow effect when image is selected */}
                        {groupImageUri && (
                            <View style={{
                                position: 'absolute',
                                top: -4,
                                left: -4,
                                right: -4,
                                bottom: -4,
                                borderRadius: 52,
                                backgroundColor: accentColor,
                                opacity: 0.3,
                                ...(Platform.OS === 'ios' && {
                                    shadowColor: accentColor,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.5,
                                    shadowRadius: 20,
                                }),
                            }} />
                        )}
                        {groupImageUri ? (
                            <Image
                                source={{ uri: groupImageUri }}
                                style={{
                                    width: 96,
                                    height: 96,
                                    borderRadius: 48,
                                    borderWidth: 3,
                                    borderColor: accentColor,
                                }}
                            />
                        ) : (
                            <View style={{
                                width: 96,
                                height: 96,
                                borderRadius: 48,
                                backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 1)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 2,
                                borderColor: isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(203, 213, 225, 0.8)',
                                borderStyle: 'dashed',
                            }}>
                                <Feather name="camera" size={32} color={isDark ? "#64748b" : "#94a3b8"} />
                                <Text style={{
                                    marginTop: 4,
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: isDark ? '#64748b' : '#94a3b8',
                                }}>
                                    Add Photo
                                </Text>
                            </View>
                        )}
                        {isUploadingImage && (
                            <View style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                width: 96,
                                height: 96,
                                borderRadius: 48,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <ActivityIndicator color="white" size="small" />
                            </View>
                        )}
                        {/* Edit badge */}
                        {groupImageUri && !isUploadingImage && (
                            <View style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: accentColor,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 2,
                                borderColor: isDark ? '#0a0f1a' : '#ffffff',
                            }}>
                                <Feather name="edit-2" size={12} color="#ffffff" />
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Group Name Input */}
                <View style={{
                    width: '100%',
                    maxWidth: 300,
                }}>
                    <TextInput
                        style={{
                            fontSize: 20,
                            fontWeight: '700',
                            color: isDark ? '#ffffff' : '#0f172a',
                            textAlign: 'center',
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 0.8)',
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(203, 213, 225, 0.6)',
                            ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
                        }}
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
            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(241, 245, 249, 1)',
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    height: 50,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)',
                }}>
                    <Feather name="search" size={18} color={isDark ? "#64748b" : "#94a3b8"} />
                    <TextInput
                        style={{
                            flex: 1,
                            marginLeft: 12,
                            fontSize: 16,
                            color: isDark ? '#ffffff' : '#0f172a',
                            ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
                        }}
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
                <View style={{ 
                    maxHeight: 140, 
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 0.8)',
                }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 8,
                    }}>
                        <View style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            backgroundColor: accentSoft,
                            borderRadius: 10,
                        }}>
                            <Text style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: accentStrong,
                            }}>
                                {selectedMembers.length} {selectedMembers.length === 1 ? 'member' : 'members'}
                            </Text>
                        </View>
                    </View>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ 
                            paddingHorizontal: 16, 
                            paddingBottom: 12,
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 8,
                        }}
                    >
                        {selectedMembers.map((member) => (
                            <View
                                key={member.publicKey}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 1)',
                                    borderRadius: 20,
                                    paddingLeft: 4,
                                    paddingRight: 10,
                                    paddingVertical: 4,
                                    borderWidth: 1,
                                    borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(203, 213, 225, 0.6)',
                                }}
                            >
                                <Image
                                    source={{ uri: getProfileImageUrl(member.publicKey) || FALLBACK_PROFILE_IMAGE }}
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        marginRight: 6,
                                    }}
                                />
                                <Text style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: isDark ? '#ffffff' : '#0f172a',
                                    marginRight: 6,
                                    maxWidth: 100,
                                }} numberOfLines={1}>
                                    {member.username}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => handleRemoveMember(member.publicKey)}
                                    disabled={isCreating}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <View style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        backgroundColor: isDark ? 'rgba(71, 85, 105, 0.8)' : 'rgba(203, 213, 225, 0.8)',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Feather name="x" size={10} color={isDark ? "#94a3b8" : "#64748b"} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Search Results */}
            <FlatList
                data={searchResults}
                keyExtractor={(item) => item.publicKey}
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                    searchQuery.trim().length > 0 && !isSearching ? (
                        <View style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 40,
                            paddingHorizontal: 24,
                        }}>
                            <View style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(241, 245, 249, 1)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16,
                            }}>
                                <Feather name="users" size={28} color={isDark ? "#64748b" : "#94a3b8"} />
                            </View>
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: isDark ? '#94a3b8' : '#64748b',
                                textAlign: 'center',
                            }}>
                                No users found
                            </Text>
                            <Text style={{
                                fontSize: 14,
                                color: isDark ? '#64748b' : '#94a3b8',
                                textAlign: 'center',
                                marginTop: 4,
                            }}>
                                Try a different username
                            </Text>
                        </View>
                    ) : searchQuery.trim().length === 0 && selectedMembers.length === 0 ? (
                        <View style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 40,
                            paddingHorizontal: 24,
                        }}>
                            <View style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: accentSoft,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16,
                            }}>
                                <Feather name="user-plus" size={28} color={accentStrong} />
                            </View>
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: isDark ? '#e2e8f0' : '#334155',
                                textAlign: 'center',
                            }}>
                                Add members to your group
                            </Text>
                            <Text style={{
                                fontSize: 14,
                                color: isDark ? '#64748b' : '#94a3b8',
                                textAlign: 'center',
                                marginTop: 4,
                            }}>
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
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                        }}
                    >
                        <Image
                            source={{ uri: getProfileImageUrl(item.publicKey) || FALLBACK_PROFILE_IMAGE }}
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 24,
                                marginRight: 14,
                                backgroundColor: isDark ? '#334155' : '#e2e8f0',
                            }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: isDark ? '#ffffff' : '#0f172a',
                            }}>
                                {item.username}
                            </Text>
                            {item.extraData?.DisplayName && (
                                <Text style={{
                                    fontSize: 14,
                                    color: isDark ? '#64748b' : '#94a3b8',
                                    marginTop: 2,
                                }}>
                                    {item.extraData.DisplayName}
                                </Text>
                            )}
                        </View>
                        <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: accentSoft,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Feather name="plus" size={16} color={accentStrong} />
                        </View>
                    </TouchableOpacity>
                )}
            />

            {/* Create Button */}
            <View style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(241, 245, 249, 0.8)',
                backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
            }}>
                <TouchableOpacity
                    onPress={handleCreate}
                    disabled={!isFormValid}
                    activeOpacity={0.8}
                    style={{
                        width: '100%',
                        borderRadius: 16,
                        paddingVertical: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isFormValid ? accentColor : (isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(241, 245, 249, 1)'),
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
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather
                                name="users"
                                size={18}
                                color={isFormValid ? onAccent : (isDark ? "#64748b" : "#94a3b8")}
                                style={{ marginRight: 8 }}
                            />
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '700',
                                color: isFormValid ? onAccent : (isDark ? "#64748b" : "#94a3b8"),
                            }}>
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
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {isWebDesktop ? (
                    // Desktop: Show with sidebars visible
                    <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(10, 15, 26, 0.85)' : 'rgba(255, 255, 255, 0.85)' }}>
                        {/* Left sidebar */}
                        <DesktopLeftNav />
                        
                        {/* Center content area */}
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <View style={{
                                flex: 1,
                                width: '100%',
                                maxWidth: CENTER_CONTENT_MAX_WIDTH,
                                backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
                                borderLeftWidth: 1,
                                borderRightWidth: 1,
                                borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)',
                            }}>
                                {renderContent()}
                            </View>
                        </View>
                        
                        {/* Right sidebar */}
                        <DesktopRightNav />
                    </View>
                ) : (
                    // Mobile: Standard page sheet
                    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0a0f1a' : '#ffffff' }}>
                        {renderContent()}
                    </SafeAreaView>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}
