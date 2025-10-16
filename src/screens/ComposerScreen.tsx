import React, { useState, useLayoutEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Button,
  TouchableOpacity,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { type RootStackParamList } from "../navigation/types";

const MAX_LENGTH = 280;

type ComposerScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Composer">;
};

export default function ComposerScreen({ navigation }: ComposerScreenProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const onPost = useCallback(() => {
    console.log("Posting:", text, images);
    // Here you would call your API to create the post
    navigation.goBack();
  }, [text, images, navigation]);

  const onCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "New Post",
      headerLeft: () => <Button onPress={onCancel} title="Cancel" />,
    });
  }, [navigation, onCancel]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button
          onPress={onPost}
          title="Post"
          disabled={text.length === 0 && images.length === 0}
        />
      ),
    });
  }, [navigation, onPost, text, images]);

  const pickImage = async () => {
    // No permissions request is needed for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImages((prevImages) => [
        ...prevImages,
        ...result.assets.map(
          (asset: ImagePicker.ImagePickerAsset) => asset.uri
        ),
      ]);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50 p-4"
      keyboardShouldPersistTaps="handled"
    >
      <View className="rounded-2xl bg-white p-4">
        <TextInput
          className="min-h-[120px] flex-1 text-base leading-6 text-gray-900"
          multiline
          placeholder="What's on your mind?"
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          maxLength={MAX_LENGTH}
          autoFocus
        />
      </View>
      <View className="mt-3 flex-row items-center justify-between rounded-xl bg-white px-4 py-3">
        <TouchableOpacity 
          onPress={pickImage} 
          className="flex-row items-center rounded-full bg-blue-50 px-4 py-2"
          activeOpacity={0.7}
        >
          <Text className="mr-2 text-xl">🖼️</Text>
          <Text className="text-sm font-medium text-blue-600">Add Photo</Text>
        </TouchableOpacity>
        <Text className="text-sm font-medium text-gray-400">
          {text.length}/{MAX_LENGTH}
        </Text>
      </View>
      {images.length > 0 && (
        <View className="mt-3 rounded-2xl bg-white p-3">
          <View className="flex-row flex-wrap">
            {images.map((uri, index) => (
              <Image
                key={index}
                source={{ uri }}
                className="m-1 h-24 w-24 rounded-xl"
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
