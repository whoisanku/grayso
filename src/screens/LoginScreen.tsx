import React, { useContext, useState, useEffect } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator } from "react-native";
import { identity } from "deso-protocol";
import { DeSoIdentityContext } from "react-deso-protocol";

const LoginScreen = () => {
  const { currentUser, isLoading } = useContext(DeSoIdentityContext);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    console.log("LoginScreen - currentUser:", currentUser);
    console.log("LoginScreen - isLoading:", isLoading);
  }, [currentUser, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setLocalLoading(false);
    }
  }, [isLoading]);

  const handleLogin = async () => {
    try {
      setLocalLoading(true);
      console.log("Starting login...");
      const result = await identity.login();
      console.log("Login result:", result);
      // Don't set loading to false here - let the context handle it
    } catch (e) {
      console.error("Login error:", e);
      setLocalLoading(false);
    } finally {
      if (!isLoading) {
        setLocalLoading(false);
      }
    }
  };

  const showLoading = isLoading || localLoading;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login with DeSo</Text>
      {showLoading && (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      )}
      <Button
        title={showLoading ? 'Logging in...' : 'Login'}
        onPress={handleLogin}
        disabled={showLoading}
      />
      {currentUser && (
        <Text style={styles.debugText}>
          User detected: {currentUser.PublicKeyBase58Check?.substring(0, 10)}...
        </Text>
      )}
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
  loader: {
    marginVertical: 10,
  },
  debugText: {
    marginTop: 20,
    fontSize: 12,
    color: "#666",
  },
});

export default LoginScreen;
