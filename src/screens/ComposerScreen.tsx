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
      className="flex-1 bg-white p-3"
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-row">
        <TextInput
          className="min-h-[100px] flex-1 text-lg text-slate-900"
          multiline
          placeholder="What's on your mind?"
          value={text}
          onChangeText={setText}
          maxLength={MAX_LENGTH}
        />
      </View>
      <View className="mt-2 flex-row items-center justify-between border-t border-slate-200 pt-2">
        <TouchableOpacity onPress={pickImage} className="p-2">
          <Text className="text-2xl">🖼️</Text>
        </TouchableOpacity>
        <Text className="text-sm text-gray-500">
          {text.length}/{MAX_LENGTH}
        </Text>
      </View>
      <View className="mt-3 flex-row flex-wrap">
        {images.map((uri, index) => (
          <Image
            key={index}
            source={{ uri }}
            className="m-1.5 h-24 w-24 rounded-lg border border-slate-200"
          />
        ))}
      </View>
    </ScrollView>
  );
}
