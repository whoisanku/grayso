import React from "react";
import { View, Text, Image } from "react-native";
import { Feather } from "@expo/vector-icons";

interface Post {
  id: string;
  user: string;
  handle: string;
  text: string;
  time: string;
  avatar: string;
}
export default function PostCard({ post }: { post: Post }) {
  return (
    <View className="flex-row border-b border-slate-200 px-4 py-3">
      <Image
        source={{ uri: post.avatar }}
        className="mr-2 h-10 w-10 rounded-full"
      />
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="mr-1 font-semibold text-slate-900">{post.user}</Text>
          <Text className="mr-1 text-slate-500">{post.handle}</Text>
          <Text className="text-slate-500"> · {post.time}</Text>
        </View>
        <Text className="mt-1 text-slate-800">{post.text}</Text>
        <View className="mt-2 w-32 flex-row justify-between">
          <Feather name="message-circle" size={16} />
          <Feather name="repeat" size={16} />
          <Feather name="heart" size={16} />
        </View>
      </View>
    </View>
  );
}
