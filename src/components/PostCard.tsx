import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
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
    <View style={styles.container}>
      <Image source={{ uri: post.avatar }} style={styles.avatar} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{post.user}</Text>
          <Text style={styles.handle}>{post.handle}</Text>
          <Text style={styles.time}> · {post.time}</Text>
        </View>
        <Text style={styles.body}>{post.text}</Text>
        <View style={styles.actions}>
          <Feather name="message-circle" size={16} />
          <Feather name="repeat" size={16} />
          <Feather name="heart" size={16} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  content: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center" },
  name: { fontWeight: "bold", marginRight: 4 },
  handle: { color: "#666", marginRight: 4 },
  time: { color: "#666" },
  body: { marginTop: 4 },
  actions: {
    flexDirection: "row",
    marginTop: 8,
    width: 120,
    justifyContent: "space-between",
  },
});
