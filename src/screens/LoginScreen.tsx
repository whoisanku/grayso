import React, { useContext } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { identity } from "deso-protocol";
import { DeSoIdentityContext } from "react-deso-protocol";
const LoginScreen = () => {
  const { isLoading } = useContext(DeSoIdentityContext);

  const handleLogin = async () => {
    await identity.login();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login with DeSo</Text>
      <Button title="Login" onPress={handleLogin} disabled={isLoading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
});

export default LoginScreen;
