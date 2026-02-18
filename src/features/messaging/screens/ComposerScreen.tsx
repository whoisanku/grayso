import React, { useState, useLayoutEffect, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "@/navigation/types";
import { Feather } from "@expo/vector-icons";
import { DeSoIdentityContext } from "react-deso-protocol";
import { buildProfilePictureUrl, submitPost } from "deso-protocol";
import { toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { uploadImage, uploadVideo } from "@/lib/media";
import { FALLBACK_PROFILE_IMAGE } from "@/utils/deso";
import ScreenWrapper from "../../../components/ScreenWrapper";
import CircularProgressIndicator from "../../../components/CircularProgressIndicator";
import { BlurView } from "expo-blur";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { DesktopLeftNav } from "../components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "../components/desktop/DesktopRightNav";
import { CENTER_CONTENT_MAX_WIDTH, useLayoutBreakpoints } from "@/alf/breakpoints";
import { Toast } from "@/components/ui/Toast";
import { PageTopBar } from "@/components/ui/PageTopBar";
import { useMobileWebKeyboardInset } from "@/lib/keyboard/useMobileWebKeyboardInset";

// Check if iOS 26+ for Liquid Glass support
const isIOS26OrAbove = Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 26;

// Conditionally import LiquidGlassView only on iOS 26+
let LiquidGlassView: React.ComponentType<any> | null = null;
if (isIOS26OrAbove) {
  try {
    LiquidGlassView = require("@callstack/liquid-glass").LiquidGlassView;
  } catch {
    LiquidGlassView = null;
  }
}

const MAX_LENGTH = 280;
const TOOLBAR_RESERVE_HEIGHT = 96;
const MOBILE_KEYBOARD_BAR_GAP = 12;

type ComposerScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Composer">;
};

export function ComposerScreen({ navigation }: ComposerScreenProps) {
  const [text, setText] = useState("");
  // Track media with their upload status and URLs
  const [mediaItems, setMediaItems] = useState<{
    localUri: string;
    uploadedUrl: string | null;
    isUploading: boolean;
    error: boolean;
    type: 'image' | 'video';
  }[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const { isDark, accentColor, accentStrong, accentSoft } = useAccentColor();
  const { currentUser } = React.useContext(DeSoIdentityContext);
  const { isDesktop } = useLayoutBreakpoints();
  const isWebDesktop = Platform.OS === "web" && isDesktop;
  const { keyboardInset, isMobileWeb } = useMobileWebKeyboardInset();
  const isMobileWebComposer = Platform.OS === "web" && !isWebDesktop && isMobileWeb;
  const toolbarBottomInsetTarget =
    isMobileWebComposer && keyboardInset > 0
      ? keyboardInset + MOBILE_KEYBOARD_BAR_GAP
      : 0;

  // Keyboard animation for toolbar positioning
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const webToolbarBottomInset = useSharedValue(0);
  const previousToolbarInsetRef = useRef(0);

  useEffect(() => {
    const isOpeningKeyboard = toolbarBottomInsetTarget > previousToolbarInsetRef.current;
    previousToolbarInsetRef.current = toolbarBottomInsetTarget;

    if (!isMobileWebComposer) {
      webToolbarBottomInset.value = withTiming(0, {
        duration: 90,
        easing: Easing.out(Easing.quad),
      });
      return;
    }

    if (isOpeningKeyboard) {
      webToolbarBottomInset.value = toolbarBottomInsetTarget;
      return;
    }

    webToolbarBottomInset.value = withTiming(toolbarBottomInsetTarget, {
      duration: 90,
      easing: Easing.out(Easing.quad),
    });
  }, [isMobileWebComposer, toolbarBottomInsetTarget, webToolbarBottomInset]);

  const toolbarAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS === "web") {
      return {
        bottom: webToolbarBottomInset.value,
      };
    }

    return {
      transform: [{ translateY: keyboardHeight.value }],
    };
  });

  const scrollBottomPadding = 20 + TOOLBAR_RESERVE_HEIGHT;

  const avatarUri = React.useMemo(() => {
    if (!currentUser?.PublicKeyBase58Check) {
      return FALLBACK_PROFILE_IMAGE;
    }
    const rawUrl = buildProfilePictureUrl(currentUser.PublicKeyBase58Check, {
      fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
    });
    return toPlatformSafeImageUrl(rawUrl) ?? rawUrl;
  }, [currentUser?.PublicKeyBase58Check]);

  if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Upload media immediately when selected
  const uploadMediaImmediately = async (localUri: string, type: 'image' | 'video', index: number) => {
    if (!currentUser?.PublicKeyBase58Check) return;

    try {
      let uploadedUrl;
      if (type === 'video') {
        uploadedUrl = await uploadVideo(currentUser.PublicKeyBase58Check, localUri);
      } else {
        uploadedUrl = await uploadImage(currentUser.PublicKeyBase58Check, localUri);
      }
      
      setMediaItems(prev => prev.map((item, i) => 
        i === index ? { ...item, uploadedUrl, isUploading: false, error: false } : item
      ));
    } catch (error) {
      console.error("Media upload failed:", error);
      setMediaItems(prev => prev.map((item, i) => 
        i === index ? { ...item, isUploading: false, error: true } : item
      ));
    }
  };

  const onPost = useCallback(async () => {
    const allUploaded = mediaItems.every(item => item.uploadedUrl || item.error);
    if ((text.length === 0 && mediaItems.length === 0) || !currentUser?.PublicKeyBase58Check) return;
    
    // Wait for any pending uploads
    if (!allUploaded) {
      Toast.show({
        type: 'error',
        text1: 'Please wait',
        text2: 'Media is still uploading',
      });
      return;
    }

    // Filter out failed uploads and split by type
    const successfulItems = mediaItems.filter(item => item.uploadedUrl);
    
    const imageUrls = successfulItems
      .filter(item => item.type === 'image')
      .map(item => item.uploadedUrl as string);
      
    const videoUrls = successfulItems
      .filter(item => item.type === 'video')
      .map(item => item.uploadedUrl as string);

    setIsPosting(true);

    try {
      await submitPost({
        UpdaterPublicKeyBase58Check: currentUser.PublicKeyBase58Check,
        BodyObj: {
          Body: text,
          ImageURLs: imageUrls,
          VideoURLs: videoUrls,
        },
      });

      Toast.show({
        type: 'success',
        text1: 'Post created!',
        text2: 'Your post has been published',
      });

      navigation.goBack();
    } catch (error) {
      console.error("Failed to create post:", error);
      Toast.show({
        type: 'error',
        text1: 'Failed to create post',
        text2: 'Please try again',
      });
    } finally {
      setIsPosting(false);
    }
  }, [text, mediaItems, navigation, currentUser]);

  const onCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      const startIndex = mediaItems.length;
      const newItems = result.assets.map((asset) => ({
        localUri: asset.uri,
        uploadedUrl: null,
        isUploading: true,
        error: false,
        type: (asset.type === 'video' ? 'video' : 'image') as 'image' | 'video',
      }));
      
      setMediaItems(prev => [...prev, ...newItems]);
      
      // Start uploading each media item immediately
      result.assets.forEach((asset, i) => {
        const type = (asset.type === 'video' ? 'video' : 'image') as 'image' | 'video';
        uploadMediaImmediately(asset.uri, type, startIndex + i);
      });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission is required to take photos');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const startIndex = mediaItems.length;
      const newItem = {
        localUri: result.assets[0].uri,
        uploadedUrl: null,
        isUploading: true,
        error: false,
        type: 'image' as const,
      };
      setMediaItems(prev => [...prev, newItem]);
      uploadMediaImmediately(result.assets[0].uri, 'image', startIndex);
    }
  };

  const removeMedia = (indexToRemove: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMediaItems(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const canPost = text.trim().length > 0 || mediaItems.length > 0;

  // Toolbar action button component
  const ToolbarButton = ({ 
    icon, 
    onPress, 
    disabled = false,
    label,
  }: { 
    icon: keyof typeof Feather.glyphMap; 
    onPress: () => void; 
    disabled?: boolean;
    label: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled
          ? isDark
            ? "rgba(51, 65, 85, 0.6)"
            : "#e2e8f0"
          : accentSoft,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Feather 
        name={icon} 
        size={20} 
        color={disabled ? (isDark ? '#475569' : '#94a3b8') : accentColor} 
      />
    </TouchableOpacity>
  );

  // Render glass toolbar
  const renderToolbar = () => {
    const toolbarContent = (
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <ToolbarButton icon="image" onPress={pickImage} label="Choose media from library" />
          <ToolbarButton icon="camera" onPress={takePhoto} label="Take a photo" />
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${MAX_LENGTH - text.length} characters remaining`}
          accessibilityValue={{ min: 0, max: MAX_LENGTH, now: text.length }}
        >
          <CircularProgressIndicator current={text.length} max={MAX_LENGTH} size={26} />
        </View>
      </View>
    );

    const containerClasses = `w-full overflow-hidden rounded-[24px] px-4 py-3 border border-black/10 dark:border-white/15`;

    // Fallback shadow style
    const shadowStyle = {
      shadowColor: isDark ? "#000" : "#64748b",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 12,
      elevation: 8,
    };

    if (LiquidGlassView) {
      return (
        <View className="bg-transparent px-4 py-2">
          <LiquidGlassView
            effect="regular"
            className={containerClasses}
            style={shadowStyle}
          >
            {toolbarContent}
          </LiquidGlassView>
        </View>
      );
    }

    // Fallback to BlurView
    return (
      <View className="bg-transparent px-4 py-2">
        <BlurView
          intensity={Platform.OS === "ios" ? 60 : 100}
          tint={isDark ? "dark" : "light"}
          className={containerClasses}
          style={shadowStyle}
        >
          {toolbarContent}
        </BlurView>
      </View>
    );
  };

  const content = (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      keyboardAvoiding={false}
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
    >
      <View className="flex-1">
        <PageTopBar
          title=""
          leftSlot={
            <TouchableOpacity
              onPress={onCancel}
              className="px-1 py-2"
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel post"
            >
              <Text className="text-base font-medium text-slate-600 dark:text-slate-400">
                Cancel
              </Text>
            </TouchableOpacity>
          }
          rightSlot={
            <TouchableOpacity
              onPress={onPost}
              disabled={!canPost || isPosting}
              className="rounded-full px-5 py-2"
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isPosting ? "Posting..." : "Submit post"}
              accessibilityState={{ disabled: !canPost || isPosting }}
              style={
                canPost
                  ? {
                      backgroundColor: accentColor,
                      shadowColor: accentStrong,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 8,
                      elevation: 5,
                    }
                  : {
                      backgroundColor: isDark ? "rgba(30, 41, 59, 0.9)" : "#e2e8f0",
                    }
              }
            >
              {isPosting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text
                  className="text-base font-bold"
                  style={{
                    color: canPost ? "#ffffff" : isDark ? "#94a3b8" : "#94a3b8",
                  }}
                >
                  Post
                </Text>
              )}
            </TouchableOpacity>
          }
        />

        <View className="flex-1">
          <ScrollView
            className="flex-1 px-4 pt-4"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          >
            <View className="flex-row">
              <View className="mr-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" style={{ width: 48, height: 48 }}>
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 48, height: 48, borderRadius: 24 }}
                  contentFit="cover"
                  transition={300}
                />
              </View>
              <View className="flex-1">
                <TextInput
                  className="min-h-[100px] text-lg leading-6 text-slate-900 dark:text-slate-100"
                  multiline
                  placeholder="What's happening?"
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  accessibilityLabel="Post content"
                  accessibilityHint="Type your message here"
                  value={text}
                  onChangeText={setText}
                  maxLength={MAX_LENGTH + 20} // Allow slight overflow for UX
                  autoFocus
                  textAlignVertical="top"
                  style={{ 
                    paddingTop: 0,
                    ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
                  }}
                />
              </View>
            </View>

            {/* Media Previews */}
            {mediaItems.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-4 pl-12"
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {mediaItems.map((item, index) => (
                  <View key={index} className="relative mr-3">
                    <Image
                      source={{ uri: item.localUri }}
                      style={{ width: 192, height: 256, borderRadius: 16 }}
                      className="bg-slate-100 dark:bg-slate-800"
                      contentFit="cover"
                    />
                    {/* Video Indicator */}
                    {item.type === 'video' && (
                      <View className="absolute inset-0 items-center justify-center z-10 pointer-events-none">
                        <View className="bg-black/50 rounded-full p-3">
                            <Feather name="play" size={24} color="white" style={{ marginLeft: 2 }} />
                        </View>
                      </View>
                    )}
                    {/* Upload progress indicator */}
                    {item.isUploading && (
                      <View className="absolute inset-0 items-center justify-center bg-black/40 rounded-2xl z-20">
                        <ActivityIndicator size="large" color="white" />
                        <Text className="text-white text-xs mt-2">Uploading...</Text>
                      </View>
                    )}
                    {/* Error indicator */}
                    {item.error && (
                      <View className="absolute inset-0 items-center justify-center bg-red-500/40 rounded-2xl z-20">
                        <Feather name="alert-circle" size={32} color="white" />
                        <Text className="text-white text-xs mt-2">Upload failed</Text>
                      </View>
                    )}
                    {/* Success indicator */}
                    {item.uploadedUrl && !item.isUploading && (
                      <View className="absolute bottom-2 left-2 bg-green-500 rounded-full p-1 z-20">
                        <Feather name="check" size={14} color="white" />
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => removeMedia(index)}
                      className="absolute right-2 top-2 rounded-full p-2 z-30"
                      accessibilityRole="button"
                      accessibilityLabel="Remove media"
                      style={{
                        backgroundColor: "rgba(0,0,0,0.6)",
                      }}
                    >
                      <Feather name="x" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </ScrollView>
        </View>

        {/* Toolbar at bottom - animated to move with keyboard */}
        <Animated.View 
          style={[
            { 
              position: 'absolute', 
              bottom: 0, 
              left: 0, 
              right: 0,
            },
            toolbarAnimatedStyle
          ]}
        >
          {renderToolbar()}
        </Animated.View>
      </View>
    </ScreenWrapper>
  );

  if (isWebDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#0a0f1a' : '#f8fafc' }}>
        <DesktopLeftNav />
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
            {content}
          </View>
        </View>
        <DesktopRightNav />
      </View>
    );
  }

  return content;
}
