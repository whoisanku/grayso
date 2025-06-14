import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SvgUri } from "react-native-svg";

// Mock data for the profile, as we are only focusing on the UI
const mockProfile = {
  displayName: "Ankit Bhandari",
  handle: "ankitbhandari",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix", // Placeholder avatar
  banner: "https://placekitten.com/600/200", // Placeholder banner
  followersCount: 1234,
  followsCount: 567,
  postsCount: 890,
  description: "This is a sample bio. I love coding and cats!",
  viewer: {
    following: false,
    followedBy: true,
  },
  createdAt: new Date().toISOString(),
};

export default function ProfileScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: mockProfile.banner }} style={styles.banner} />
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <SvgUri width="100%" height="100%" uri={mockProfile.avatar} />
        </View>
        <TouchableOpacity style={styles.followButton}>
          <Text style={styles.followButtonText}>Follow</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.profileInfo}>
        <Text style={styles.displayName}>{mockProfile.displayName}</Text>
        <Text style={styles.handle}>@{mockProfile.handle}</Text>
        {/* {mockProfile.viewer.followedBy && (
          <View style={styles.followsYou}>
            <Text style={styles.followsYouText}>Follows you</Text>
          </View>
        )} */}
        <Text style={styles.description}>{mockProfile.description}</Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>
            <Text style={styles.statCount}>{mockProfile.followersCount}</Text>{" "}
            Followers
          </Text>
          <Text style={styles.stat}>
            <Text style={styles.statCount}>{mockProfile.followsCount}</Text>{" "}
            Following
          </Text>
          <Text style={styles.stat}>
            <Text style={styles.statCount}>{mockProfile.postsCount}</Text> Posts
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  banner: {
    width: "100%",
    height: 120,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginTop: -40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    overflow: "hidden",
    backgroundColor: "white",
  },
  followButton: {
    backgroundColor: "#000",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 48,
  },
  followButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  profileInfo: {
    padding: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "bold",
  },
  handle: {
    fontSize: 16,
    color: "gray",
  },
  followsYou: {
    backgroundColor: "#eee",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  followsYouText: {
    color: "#555",
    fontSize: 12,
  },
  description: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  stats: {
    flexDirection: "row",
    marginTop: 16,
  },
  stat: {
    marginRight: 16,
    fontSize: 16,
  },
  statCount: {
    fontWeight: "bold",
  },
});
