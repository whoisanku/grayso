import React, { useContext } from "react";
import { View, Text, StyleSheet, Button } from "react-native";
import { identity } from "deso-protocol";
import { DeSoIdentityContext } from "react-deso-protocol";

export default function HomeScreen() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const handleLogout = async () => {
    try {
      const result = await identity.logout();
      console.log("Logout result:", result);
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  return (
    <View style={styles.center}>
      <Text>Feed page (empty)</Text>
      <Text>{currentUser?.PublicKeyBase58Check}</Text>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
