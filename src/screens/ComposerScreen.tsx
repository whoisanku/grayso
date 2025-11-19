import React, { useState, useLayoutEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "../navigation/types";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { DeSoIdentityContext } from "react-deso-protocol";
import { buildProfilePictureUrl, submitPost, identity } from "deso-protocol";
import { FALLBACK_PROFILE_IMAGE } from "../utils/deso";

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
      // 1. Get JWT for uploads/posting
      const jwt = await identity.jwt();
      
      // 2. Upload images if any
      let imageUrls: string[] = [];
      if (images.length > 0) {
        imageUrls = await Promise.all(
          images.map(uri => uploadImageToDeso(uri, currentUser.PublicKeyBase58Check, jwt))
        );
      }

      // 3. Submit Post
      await submitPost({
        UpdaterPublicKeyBase58Check: currentUser.PublicKeyBase58Check,
        BodyObj: {
          Body: text,
          ImageURLs: imageUrls,
          VideoURLs: [],
        },
      });

      // 4. Success
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
      headerShown: false, // We'll use a custom header
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

  const removeImage = (indexToRemove: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const canPost = text.trim().length > 0 || images.length > 0;

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      {/* Custom Header */}
      <View 
        style={{ paddingTop: Platform.OS === "android" ? insets.top + 10 : 10 }} 
        className="flex-row items-center justify-between border-b border-slate-100 bg-white px-4 pb-3 dark:border-slate-800 dark:bg-slate-950"
      >
        <TouchableOpacity 
          onPress={onCancel}
          className="p-2"
          activeOpacity={0.7}
        >
          <Text className="text-lg font-medium text-slate-600 dark:text-slate-400">Cancel</Text>
        </TouchableOpacity>
        
        {/* Removed "New Post" title as requested */}
        
        <TouchableOpacity 
          onPress={onPost}
          disabled={!canPost || isPosting}
          className={`rounded-full px-6 py-2.5 ${
            canPost 
              ? "bg-indigo-600 dark:bg-indigo-500" 
              : "bg-slate-200 dark:bg-slate-800"
          }`}
          activeOpacity={0.8}
        >
          {isPosting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className={`text-base font-bold ${
              canPost ? "text-white" : "text-slate-400 dark:text-slate-500"
            }`}>
              Post
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView 
          className="flex-1 px-4 pt-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 80 }}
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
                maxLength={MAX_LENGTH}
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
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5"
                  >
                    <Feather name="x" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </ScrollView>

        {/* Bottom Toolbar */}
        <View 
          className="border-t border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity 
              onPress={pickImage}
              className="rounded-full bg-indigo-50 p-3 active:bg-indigo-100 dark:bg-indigo-900/20 dark:active:bg-indigo-900/40"
            >
              <Feather name="image" size={24} color={isDark ? "#818cf8" : "#4f46e5"} />
            </TouchableOpacity>

            <Text className={`text-sm font-medium ${
              text.length > MAX_LENGTH * 0.9 
                ? "text-red-500" 
                : "text-slate-400 dark:text-slate-600"
            }`}>
              {text.length} / {MAX_LENGTH}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
