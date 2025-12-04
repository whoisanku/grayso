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
  StyleSheet,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "../../../navigation/types";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { DeSoIdentityContext } from "react-deso-protocol";
import { buildProfilePictureUrl, submitPost, identity } from "deso-protocol";
import { FALLBACK_PROFILE_IMAGE } from "../../../utils/deso";
import ScreenWrapper from "../../../components/ScreenWrapper";
import CircularProgressIndicator from "../../../components/CircularProgressIndicator";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";

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

export default function ComposerScreen({ navigation }: ComposerScreenProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { currentUser } = React.useContext(DeSoIdentityContext);

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

  const uploadImageToDeso = async (uri: string, userPublicKey: string, jwt: string): Promise<string> => {
    const filename = uri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    const formData = new FormData();
    formData.append("file", { uri, name: filename, type } as any);
    formData.append("UserPublicKeyBase58Check", userPublicKey);
    formData.append("JWT", jwt);

    const response = await fetch("https://node.deso.org/api/v0/upload-image", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to upload image");
    }

    const data = await response.json();
    return data.ImageURL;
  };

  const onPost = useCallback(async () => {
    if ((text.length === 0 && images.length === 0) || !currentUser?.PublicKeyBase58Check) return;

    setIsPosting(true);

    try {
      const jwt = await identity.jwt();

      let imageUrls: string[] = [];
      if (images.length > 0) {
        imageUrls = await Promise.all(
          images.map(uri => uploadImageToDeso(uri, currentUser.PublicKeyBase58Check, jwt))
        );
      }

      await submitPost({
        UpdaterPublicKeyBase58Check: currentUser.PublicKeyBase58Check,
        BodyObj: {
          Body: text,
          ImageURLs: imageUrls,
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
  }, [text, images, navigation, currentUser]);

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
      quality: 1,
    });

    if (!result.canceled) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setImages((prevImages) => [
        ...prevImages,
        ...result.assets.map(
          (asset: ImagePicker.ImagePickerAsset) => asset.uri
        ),
      ]);
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
      setImages((prevImages) => [...prevImages, result.assets[0].uri]);
    }
  };

  const removeImage = (indexToRemove: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const canPost = text.trim().length > 0 || images.length > 0;

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
      className={`rounded-full p-2.5 ${disabled ? 'opacity-40' : 'active:opacity-70'}`}
      style={{
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(99, 102, 241, 0.1)',
      }}
    >
      <Feather 
        name={icon} 
        size={20} 
        color={disabled ? (isDark ? '#475569' : '#94a3b8') : '#0085ff'} 
      />
    </TouchableOpacity>
  );

  // Glass container styles
  const glassContainerStyle = {
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
    borderRadius: 24,
    shadowColor: isDark ? "#000" : "#64748b",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 12,
    elevation: 8,
  };

  // Toolbar wrapper style with matching background
  const toolbarWrapperStyle = {
    backgroundColor: isDark ? "#020617" : "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  };

  // Render glass toolbar
  const renderToolbar = () => {
    const toolbarContent = (
      <View style={styles.toolbarContent}>
        <View style={styles.toolbarActions}>
          <ToolbarButton icon="image" onPress={pickImage} />
          <ToolbarButton icon="camera" onPress={takePhoto} />
        </View>
        <CircularProgressIndicator current={text.length} max={MAX_LENGTH} size={26} />
      </View>
    );

    if (LiquidGlassView) {
      return (
        <View style={toolbarWrapperStyle}>
          <LiquidGlassView
            effect="regular"
            style={[styles.glassToolbar, glassContainerStyle]}
          >
            {toolbarContent}
          </LiquidGlassView>
        </View>
      );
    }

    // Fallback to BlurView
    return (
      <View style={toolbarWrapperStyle}>
        <BlurView
          intensity={Platform.OS === "ios" ? 60 : 100}
          tint={isDark ? "dark" : "light"}
          style={[styles.blurToolbar, glassContainerStyle]}
        >
          {toolbarContent}
        </BlurView>
      </View>
    );
  };

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      keyboardAvoiding={false}
      backgroundColor={isDark ? "#020617" : "#ffffff"}
    >
      <View className="flex-1">
        {/* Custom Header */}
        <View
          className="flex-row items-center justify-between border-b border-slate-100 bg-white px-4 pb-3 pt-2 dark:border-slate-800 dark:bg-slate-950"
        >
          <TouchableOpacity
            onPress={onCancel}
            className="p-2"
            activeOpacity={0.7}
          >
            <Text className="text-lg font-medium text-slate-600 dark:text-slate-400">Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onPost}
            disabled={!canPost || isPosting}
            className={`rounded-full px-6 py-2.5 ${canPost
              ? "bg-[#0085ff]"
              : "bg-slate-200 dark:bg-slate-800"
              }`}
            activeOpacity={0.8}
            style={canPost ? {
              shadowColor: "#0085ff",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            } : undefined}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className={`text-base font-bold ${canPost ? "text-white" : "text-slate-400 dark:text-slate-500"
                }`}>
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
                  style={{ paddingTop: 0 }}
                />
              </View>
            </View>

            {/* Image Previews */}
            {images.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-4 pl-12"
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {images.map((uri, index) => (
                  <View key={index} className="relative mr-3">
                    <Image
                      source={{ uri }}
                      className="h-64 w-48 rounded-2xl bg-slate-100 dark:bg-slate-800"
                      resizeMode="cover"
                    />
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
              backgroundColor: isDark ? "#020617" : "#ffffff",
            },
            toolbarAnimatedStyle
          ]}
        >
          {renderToolbar()}
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  toolbarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  glassToolbar: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  blurToolbar: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
