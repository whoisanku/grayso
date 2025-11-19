import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DeSoIdentityContext } from "react-deso-protocol";
import * as SecureStore from "expo-secure-store";
import * as bip39 from "bip39";
import { HDKey } from "@scure/bip32";
import { 
  identity, 
  submitPost, 
  signTx, 
  publicKeyToBase58Check,
  getSingleProfile,
  type ProfileEntryResponse
} from "deso-protocol";
import { Alert } from "react-native";

export type User = {
  PublicKeyBase58Check: string;
  ProfileEntryResponse?: ProfileEntryResponse | null;
  BalanceNanos?: number;
  UsersWhoHODLYouCount?: number;
};

type AuthContextType = {
  currentUser: User | null;
  isLoading: boolean;
  isSeedLogin: boolean;
  seedHex: string | null;
  loginWithSeed: (mnemonic: string) => Promise<void>;
  logout: () => Promise<void>;
  signAndSubmitTx: (txHex: string) => Promise<string>;
  decryptMessage: (message: any, accessGroups: any[]) => Promise<any>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const SEED_KEY = "deso_seed_phrase";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser: identityUser, isLoading: isIdentityLoading } = useContext(DeSoIdentityContext);
  const [seedUser, setSeedUser] = useState<User | null>(null);
  const [isSeedLoading, setIsSeedLoading] = useState(true);
  const [seedHex, setSeedHex] = useState<string | null>(null);

  const loginWithSeed = useCallback(async (mnemonic: string) => {
    try {
      console.log("Attempting seed login with mnemonic length:", mnemonic.split(" ").length);
      // console.log("Mnemonic:", mnemonic); // CAUTION: Do not log actual mnemonic in production
      
      if (!bip39.validateMnemonic(mnemonic)) {
        console.error("bip39.validateMnemonic returned false");
        throw new Error("Invalid mnemonic");
      }

      const seed = await bip39.mnemonicToSeed(mnemonic);
      const hd = HDKey.fromMasterSeed(seed);
      // DeSo derivation path: m/44'/0'/0'/0/0
      const key = hd.derive("m/44'/0'/0'/0/0");
      
      if (!key.privateKey || !key.publicKey) {
        throw new Error("Failed to derive keys");
      }

      const derivedSeedHex = Buffer.from(key.privateKey).toString('hex');
      const publicKeyBase58 = publicKeyToBase58Check(key.publicKey, { network: "mainnet" });

      setSeedHex(derivedSeedHex);
      await SecureStore.setItemAsync(SEED_KEY, mnemonic);

      // Fetch profile
      try {
        const profile = await getSingleProfile({
          PublicKeyBase58Check: publicKeyBase58,
        });
        
        setSeedUser({
          PublicKeyBase58Check: publicKeyBase58,
          ProfileEntryResponse: profile.Profile,
        });
      } catch (err) {
        console.log("Profile not found or error fetching profile", err);
        // User might not have a profile yet, but is still logged in
        setSeedUser({
          PublicKeyBase58Check: publicKeyBase58,
          ProfileEntryResponse: null,
        });
      }
    } catch (e) {
      console.error("Login failed:", e);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    if (seedUser) {
      await SecureStore.deleteItemAsync(SEED_KEY);
      setSeedUser(null);
      setSeedHex(null);
    } else {
      await identity.logout();
    }
  }, [seedUser]);

  // Load seed from storage on mount
  useEffect(() => {
    const loadSeed = async () => {
      try {
        const storedMnemonic = await SecureStore.getItemAsync(SEED_KEY);
        if (storedMnemonic) {
          await loginWithSeed(storedMnemonic);
        }
      } catch (error) {
        console.error("Failed to load seed:", error);
      } finally {
        setIsSeedLoading(false);
      }
    };
    loadSeed();
  }, [loginWithSeed]);

  const signAndSubmitTx = useCallback(async (txHex: string, options?: any) => {
    if (seedHex) {
      // Manual signing
      const signedTxHex = await signTx(txHex, seedHex, options);
      // We need to submit the signed transaction. 
      // deso-protocol's submitTransaction might not be directly exposed or might be named differently.
      // Actually, `submitPost` handles everything. 
      // But here we are signing a raw transaction hex.
      // We need a way to broadcast it.
      // `deso-protocol` usually has `submitTransaction`. Let's check imports.
      // If not, we use fetch.
      
      const response = await fetch("https://node.deso.org/api/v0/submit-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          TransactionHex: signedTxHex,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit transaction");
      }
      
      const data = await response.json();
      return data.TxnHashHex;
    } else {
      // Identity signing (handled by SDK usually, but if we have a raw hex...)
      // The SDK usually handles construction + signing + submission in one go for high-level functions.
      // If we are here, it means we are doing something manual.
      // But for now, this function is primarily for the seed flow.
      throw new Error("Identity signing not implemented in this helper");
    }
  }, [seedHex]);

  const decryptMessage = useCallback(async (message: any, accessGroups: any[]) => {
    if (seedHex && seedUser) {
      // Local decryption for seed users
      const { decryptMessageLocal, deriveMessagingKey, decrypt } = await import("../utils/crypto");
      
      try {
        const encryptedText = message.MessageInfo?.EncryptedText;
        
        if (!encryptedText) {
          return {
            ...message,
            error: "Missing encrypted text",
          };
        }

        const chatType = message.ChatType;
        const isGroupChat = chatType === 'GroupChat' || chatType === 'GROUPCHAT';

        // For GROUP CHATS: need to decrypt the member's encrypted key first
        if (isGroupChat) {
          // Find the access group that contains the encrypted key  
          const accessGroup = accessGroups.find((g: any) => {
            return (
              g.AccessGroupKeyName === message.RecipientInfo?.AccessGroupKeyName &&
              g.AccessGroupOwnerPublicKeyBase58Check === message.RecipientInfo?.OwnerPublicKeyBase58Check &&
              g.AccessGroupMemberEntryResponse
            );
          });

          if (!accessGroup?.AccessGroupMemberEntryResponse?.EncryptedKey) {
            console.warn("[decryptMessage] No encrypted key found for group chat", {
              recipientKeyName: message.RecipientInfo?.AccessGroupKeyName,
              recipientOwner: message.RecipientInfo?.OwnerPublicKeyBase58Check,
              availableGroups: accessGroups.map((g: any) => ({
                keyName: g.AccessGroupKeyName,
                owner: g.AccessGroupOwnerPublicKeyBase58Check,
                hasEncryptedKey: !!g.AccessGroupMemberEntryResponse?.EncryptedKey,
              })),
            });
            return {
              ...message,
              error: "Error: access group key not found for group message",
            };
          }

          // Decrypt the member's encrypted key using the messaging private key
          const messagingPrivateKey = deriveMessagingKey(seedHex, "default-key");
          const encryptedMemberKey = accessGroup.AccessGroupMemberEntryResponse.EncryptedKey;
          
          console.log("[decryptMessage] Decrypting group member key", {
            hasEncryptedKey: !!encryptedMemberKey,
            encryptedKeyLength: Array.isArray(encryptedMemberKey) ? encryptedMemberKey.length : encryptedMemberKey?.length,
          });

          // The encrypted key is encrypted using standard ECIES (Single Derivation)
          // We must use 'decrypt' directly, NOT 'decryptMessageLocal' (which does Double Derivation)
          let encryptedMemberKeyHex: string;
          if (Array.isArray(encryptedMemberKey)) {
            encryptedMemberKeyHex = Buffer.from(encryptedMemberKey).toString("hex");
          } else {
            encryptedMemberKeyHex = encryptedMemberKey;
          }

          const decryptedMemberKeyHex = await decrypt(
            messagingPrivateKey,
            encryptedMemberKeyHex
          );

          console.log("[decryptMessage] Decrypted member key, now decrypting message", {
            memberKeyLength: decryptedMemberKeyHex.length,
            senderKey: message.SenderInfo?.AccessGroupPublicKeyBase58Check?.substring(0, 10) + "...",
          });

          // Now decrypt the message using the decrypted member key
          // Messages use Double Derivation, so we use decryptMessageLocal
          const decryptedText = await decryptMessageLocal(
            encryptedText,
            message.SenderInfo?.AccessGroupPublicKeyBase58Check,
            decryptedMemberKeyHex
          );

          const isSender = message.SenderInfo?.OwnerPublicKeyBase58Check === seedUser.PublicKeyBase58Check;

          return {
            ...message,
            DecryptedMessage: decryptedText,
            IsSender: isSender,
          };
        }

        // For DMs: use the standard approach
        const isSender = message.SenderInfo?.OwnerPublicKeyBase58Check === seedUser.PublicKeyBase58Check;
        
        let otherPartyAccessGroupKey: string;
        if (isSender) {
          // I sent this message, so decrypt using recipient's access group key
          otherPartyAccessGroupKey = 
            message.RecipientInfo?.AccessGroupPublicKeyBase58Check ||
            message.RecipientInfo?.OwnerPublicKeyBase58Check;
        } else {
          // I received this message, so decrypt using sender's access group key
          otherPartyAccessGroupKey = 
            message.SenderInfo?.AccessGroupPublicKeyBase58Check ||
            message.SenderInfo?.OwnerPublicKeyBase58Check;
        }

        if (!otherPartyAccessGroupKey) {
          return {
            ...message,
            error: "Missing access group key",
          };
        }

        // CRITICAL: Derive the messaging private key from the seed
        const messagingPrivateKey = deriveMessagingKey(seedHex, "default-key");

        console.log("[decryptMessage] Attempting DM decryption", {
          isSender,
          otherPartyKey: otherPartyAccessGroupKey.substring(0, 10) + "...",
        });

        const decryptedText = await decryptMessageLocal(
          encryptedText,
          otherPartyAccessGroupKey,
          messagingPrivateKey
        );

        return {
          ...message,
          DecryptedMessage: decryptedText,
          IsSender: isSender,
        };
      } catch (e) {
        console.error("Local decryption error:", e);
        return {
          ...message,
          error: `Decryption failed: ${e}`,
        };
      }
    } else {
      // Use identity for regular users
      return identity.decryptMessage(message, accessGroups);
    }
  }, [seedHex, seedUser]);

  // Determine current user
  // If seed user is logged in, they take precedence (or we can enforce only one at a time)
  const currentUser = seedUser || (identityUser as User | null);
  const isLoading = isIdentityLoading || isSeedLoading;
  const isSeedLogin = !!seedUser;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        loginWithSeed,
        logout,
        signAndSubmitTx,
        decryptMessage,
        isSeedLogin,
        seedHex: seedHex || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
