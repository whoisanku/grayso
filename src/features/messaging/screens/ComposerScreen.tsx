import React, { useState, useLayoutEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "@/navigation/types";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeSoIdentityContext } from "react-deso-protocol";
import { buildProfilePictureUrl, submitPost, identity } from "deso-protocol";
import { FALLBACK_PROFILE_IMAGE } from "@/utils/deso";
import ScreenWrapper from "../../../components/ScreenWrapper";
import CircularProgressIndicator from "../../../components/CircularProgressIndicator";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { DesktopLeftNav } from "../components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "../components/desktop/DesktopRightNav";
import { CENTER_CONTENT_MAX_WIDTH, useLayoutBreakpoints } from "@/alf/breakpoints";

// Check if iOS 26+ for Liquid Glass support
const isIOS26OrAbove = Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 26;

// Conditionally import LiquidGlassView only on iOS 26+
let LiquidGlassView: React.ComponentType<any> | null = null;
if (isIOS26OrAbove) {
  try {
    LiquidGlassView = require("@callstack/liquid-glass").LiquidGlassView;
  } catch (e) {
    LiquidGlassView = null;
  }
}

const MAX_LENGTH = 280;

type ComposerScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Composer">;
};

export function ComposerScreen({ navigation }: ComposerScreenProps) {
  const [text, setText] = useState("");
  // Track images with their upload status and URLs
  const [imageItems, setImageItems] = useState<{
    localUri: string;
    uploadedUrl: string | null;
    isUploading: boolean;
    error: boolean;
  }[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const insets = useSafeAreaInsets();
  const { isDark, accentColor, accentStrong, accentSoft } = useAccentColor();
  const { currentUser } = React.useContext(DeSoIdentityContext);
  const { isDesktop } = useLayoutBreakpoints();
  const isWebDesktop = Platform.OS === "web" && isDesktop;

  // Keyboard animation for toolbar positioning
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  
  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardHeight.value }],
  }));

  const avatarUri = React.useMemo(() => {
    if (!currentUser?.PublicKeyBase58Check) {
      return FALLBACK_PROFILE_IMAGE;
    }
    return buildProfilePictureUrl(currentUser.PublicKeyBase58Check, {
      fallbackImageUrl: FALLBACK_PROFILE_IMAGE,
    });
  }, [currentUser?.PublicKeyBase58Check]);

  if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Upload a single image to DeSo - handles both web and native
  const uploadImageToDeso = async (uri: string, userPublicKey: string, jwt: string): Promise<string> => {
    const formData = new FormData();
    
    if (Platform.OS === "web") {
      // On web, fetch the file and create a proper Blob
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = uri.split('/').pop() || 'image.jpg';
      formData.append("file", blob, filename);
    } else {
      // On native, use the URI-based approach
      const filename = uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append("file", { uri, name: filename, type } as any);
    }
    
    formData.append("UserPublicKeyBase58Check", userPublicKey);
    formData.append("JWT", jwt);

    // Don't set Content-Type - let the browser/fetch set it with the proper boundary
    const uploadResponse = await fetch("https://node.deso.org/api/v0/upload-image", {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.text();
      console.error("Upload failed:", errorData);
      throw new Error("Failed to upload image");
    }

    const data = await uploadResponse.json();
    return data.ImageURL;
  };

  // Upload image immediately when selected
  const uploadImageImmediately = async (localUri: string, index: number) => {
    if (!currentUser?.PublicKeyBase58Check) return;

    try {
      const jwt = await identity.jwt();
      const uploadedUrl = await uploadImageToDeso(localUri, currentUser.PublicKeyBase58Check, jwt);
      
      setImageItems(prev => prev.map((item, i) => 
        i === index ? { ...item, uploadedUrl, isUploading: false, error: false } : item
      ));
    } catch (error) {
      console.error("Image upload failed:", error);
      setImageItems(prev => prev.map((item, i) => 
        i === index ? { ...item, isUploading: false, error: true } : item
      ));
    }
  };

  const onPost = useCallback(async () => {
    const allUploaded = imageItems.every(item => item.uploadedUrl || item.error);
    if ((text.length === 0 && imageItems.length === 0) || !currentUser?.PublicKeyBase58Check) return;
    
    // Wait for any pending uploads
    if (!allUploaded) {
      alert("Please wait for images to finish uploading");
      return;
    }

    // Filter out failed uploads
    const successfulImageUrls = imageItems
      .filter(item => item.uploadedUrl)
      .map(item => item.uploadedUrl as string);

    setIsPosting(true);

    try {
      await submitPost({
        UpdaterPublicKeyBase58Check: currentUser.PublicKeyBase58Check,
        BodyObj: {
          Body: text,
          ImageURLs: successfulImageUrls,
          VideoURLs: [],
        },
      });

      navigation.goBack();
    } catch (error) {
      console.error("Failed to create post:", error);
      alert("Failed to create post. Please try again.");
    } finally {
      setIsPosting(false);
    }
  }, [text, imageItems, navigation, currentUser]);

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      const startIndex = imageItems.length;
      const newItems = result.assets.map((asset) => ({
        localUri: asset.uri,
        uploadedUrl: null,
        isUploading: true,
        error: false,
      }));
      
      setImageItems(prev => [...prev, ...newItems]);
      
      // Start uploading each image immediately
      result.assets.forEach((asset, i) => {
        uploadImageImmediately(asset.uri, startIndex + i);
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
      const startIndex = imageItems.length;
      const newItem = {
        localUri: result.assets[0].uri,
        uploadedUrl: null,
        isUploading: true,
        error: false,
      };
      setImageItems(prev => [...prev, newItem]);
      uploadImageImmediately(result.assets[0].uri, startIndex);
    }
  };

  const removeImage = (indexToRemove: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setImageItems(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const canPost = text.trim().length > 0 || imageItems.length > 0;

  // Toolbar action button component
  const ToolbarButton = ({ 
    icon, 
    onPress, 
    disabled = false 
  }: { 
    icon: keyof typeof Feather.glyphMap; 
    onPress: () => void; 
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
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
          <ToolbarButton icon="image" onPress={pickImage} />
          <ToolbarButton icon="camera" onPress={takePhoto} />
        </View>
        <CircularProgressIndicator current={text.length} max={MAX_LENGTH} size={26} />
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
        {/* Custom Header */}
        <View
          className="flex-row items-center justify-between border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#0a0f1a]"
        >
          <TouchableOpacity
            onPress={onCancel}
            className="py-2"
            activeOpacity={0.7}
          >
            <Text className="text-lg font-medium text-slate-600 dark:text-slate-400">Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onPost}
            disabled={!canPost || isPosting}
            className="rounded-full px-5 py-2"
            activeOpacity={0.8}
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
        </View>

        <View className="flex-1">
          <ScrollView
            className="flex-1 px-4 pt-4"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View className="flex-row">
              <View className="mr-3 h-12 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <Image
                  source={{ uri: avatarUri }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <TextInput
                  className="min-h-[100px] text-lg leading-6 text-slate-900 dark:text-slate-100"
                  multiline
                  placeholder="What's happening?"
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
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

            {/* Image Previews */}
            {imageItems.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-4 pl-12"
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {imageItems.map((item, index) => (
                  <View key={index} className="relative mr-3">
                    <Image
                      source={{ uri: item.localUri }}
                      className="h-64 w-48 rounded-2xl bg-slate-100 dark:bg-slate-800"
                      resizeMode="cover"
                    />
                    {/* Upload progress indicator */}
                    {item.isUploading && (
                      <View className="absolute inset-0 items-center justify-center bg-black/40 rounded-2xl">
                        <ActivityIndicator size="large" color="white" />
                        <Text className="text-white text-xs mt-2">Uploading...</Text>
                      </View>
                    )}
                    {/* Error indicator */}
                    {item.error && (
                      <View className="absolute inset-0 items-center justify-center bg-red-500/40 rounded-2xl">
                        <Feather name="alert-circle" size={32} color="white" />
                        <Text className="text-white text-xs mt-2">Upload failed</Text>
                      </View>
                    )}
                    {/* Success indicator */}
                    {item.uploadedUrl && !item.isUploading && (
                      <View className="absolute bottom-2 left-2 bg-green-500 rounded-full p-1">
                        <Feather name="check" size={14} color="white" />
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => removeImage(index)}
                      className="absolute right-2 top-2 rounded-full p-2"
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
