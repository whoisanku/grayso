import React, { useState, useLayoutEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Button,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

const MAX_LENGTH = 280;

type RootStackParamList = {
  Main: undefined;
  Composer: undefined;
};

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
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          multiline
          placeholder="What's on your mind?"
          value={text}
          onChangeText={setText}
          maxLength={MAX_LENGTH}
        />
      </View>
      <View style={styles.footer}>
        <TouchableOpacity onPress={pickImage} style={styles.iconButton}>
          <Text style={{ fontSize: 24 }}>🖼️</Text>
        </TouchableOpacity>
        <Text style={styles.charCount}>
          {text.length}/{MAX_LENGTH}
        </Text>
      </View>
      <View style={styles.imagePreviewContainer}>
        {images.map((uri, index) => (
          <Image key={index} source={{ uri }} style={styles.previewImage} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    padding: 10,
  },
  inputContainer: {
    flexDirection: "row",
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    minHeight: 100,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
  },
  iconButton: {
    padding: 8,
  },
  charCount: {
    color: "gray",
  },
  imagePreviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  previewImage: {
    width: 100,
    height: 100,
    margin: 5,
    borderRadius: 8,
  },
});
