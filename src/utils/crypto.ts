import { getSharedSecret, Point } from "@noble/secp256k1";
import { Buffer } from "buffer";
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import bs58 from "bs58";

// Helper functions for hex/bytes conversion
const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) throw new Error("Hex string must have even length");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
};

// Manual Base58 decoding for DeSo public keys
export const bs58PublicKeyToBytes = (str: string): Uint8Array => {
  const bytes = bs58.decode(str);
  const payload = bytes.slice(0, -4);
  const checksumA = bytes.slice(-4);
  const checksumB = sha256X2(payload);
  
  if (
    (checksumA[0] ^ checksumB[0]) |
    (checksumA[1] ^ checksumB[1]) |
    (checksumA[2] ^ checksumB[2]) |
    (checksumA[3] ^ checksumB[3])
  ) {
    throw new Error("Invalid checksum");
  }
  
  // Return uncompressed public key (remove 3-byte prefix)
  const pubKeyCompressed = payload.slice(3);
  // Convert compressed to uncompressed format
  try {
    const point = Point.fromHex(bytesToHex(pubKeyCompressed));
    // Note: @noble/secp256k1 v2.x uses toBytes() instead of toRawBytes()
    return point.toBytes(false); // false = uncompressed
  } catch(e) {
    console.error("Failed to parse public key:", e);
    throw e;
  }
};

export const sha256X2 = (data: Uint8Array | string): Uint8Array => {
  const d = typeof data === "string" ? hexToBytes(data) : data;
  return sha256(sha256(d));
};

const isValidHmac = (candidate: Uint8Array, knownGood: Uint8Array): boolean => {
  if (candidate.length !== knownGood.length) {
    return false;
  }
  for (let i = 0; i < knownGood.length; i++) {
    if (candidate[i] !== knownGood[i]) {
      return false;
    }
  }
  return true;
};

// KDF function matching DeSo implementation
export const kdf = (secret: Uint8Array, outputLength: number): Uint8Array => {
  let ctr = 1;
  let written = 0;
  let result = new Uint8Array();
  
  while (written < outputLength) {
    const hash = sha256(
      new Uint8Array([
        ...new Uint8Array([ctr >> 24, ctr >> 16, ctr >> 8, ctr]),
        ...secret,
      ])
    );
    result = new Uint8Array([...result, ...hash]);
    written += 32;
    ctr += 1;
  }
  
  return result;
};

// Derive messaging key from owner seed - matching DeSo's deriveAccessGroupKeyPair
export const deriveMessagingKey = (ownerSeedHex: string, groupKeyName: string = "default-key"): string => {
  const secretHash = sha256X2(ownerSeedHex);
  const keyNameHash = sha256X2(new TextEncoder().encode(groupKeyName));
  const privateKey = sha256X2(new Uint8Array([...secretHash, ...keyNameHash]));
  return bytesToHex(privateKey);
};

export const getSharedPrivateKey = (
  privKey: Uint8Array,
  pubKey: Uint8Array
): Uint8Array => {
  // Get shared secret using ECDH - compress and slice off first byte
  const sharedSecret = getSharedSecret(privKey, pubKey, true).slice(1);
  return kdf(sharedSecret, 32);
};

// DeSo decrypt function - matches deso-protocol implementation
export const decrypt = async (
  privateDecryptionKey: Uint8Array | string,
  hexString: string
): Promise<string> => {
  console.log("[decrypt] Starting", {
    hexLength: hexString.length,
    hexPreview: hexString.substring(0, 40) + "...",
  });
  
  const bytes = hexToBytes(hexString);
  console.log("[decrypt] Bytes length:", bytes.length, "First byte:", bytes[0]);
  
  const metaLength = 113; // 65 (ephemPubKey) + 16 (IV) + 32 (HMAC)
  
  if (bytes.length < metaLength) {
    console.error("[decrypt] Data too small:", bytes.length, "< required", metaLength);
    throw new Error("invalid cipher text. data too small.");
  }
  
  if (!(bytes[0] >= 2 && bytes[0] <= 4)) {
    console.error("[decrypt] Invalid first byte:", bytes[0]);
    throw new Error("invalid cipher text.");
  }
  
  const privateKey = typeof privateDecryptionKey === "string" 
    ? hexToBytes(privateDecryptionKey) 
    : privateDecryptionKey;
  
  console.log("[decrypt] Private key length:", privateKey.length);
    
  const ephemPublicKey = bytes.slice(0, 65);
  const cipherTextLength = bytes.length - metaLength;
  const counter = bytes.slice(65, 65 + 16);
  const cipherAndIv = bytes.slice(65, 65 + 16 + cipherTextLength);
  const cipherText = cipherAndIv.slice(16);
  const msgMac = bytes.slice(65 + 16 + cipherTextLength);
  
  console.log("[decrypt] Parsed structure:", {
    ephemPubKeyLen: ephemPublicKey.length,
    cipherTextLen: cipherText.length,
    counterLen: counter.length,
    macLen: msgMac.length,
  });
  
  const sharedSecretKey = getSharedPrivateKey(privateKey, ephemPublicKey);
  const encryptionKey = sharedSecretKey.slice(0, 16);
  const macKey = sha256(sharedSecretKey.slice(16));
  
  console.log("[decrypt] Derived keys:", {
    sharedSecretLen: sharedSecretKey.length,
    encryptionKeyLen: encryptionKey.length,
    macKeyLen: macKey.length,
  });
  
  // Verify HMAC using @noble/hashes
  const hmacKnownGood = hmac(sha256, macKey, cipherAndIv);
  console.log("[decrypt] HMAC check:", {
    expectedLen: hmacKnownGood.length,
    actualLen: msgMac.length,
    match: isValidHmac(msgMac, hmacKnownGood),
  });
  
  if (!isValidHmac(msgMac, hmacKnownGood)) {
    console.error("[decrypt] HMAC mismatch!");
    throw new Error("incorrect MAC");
  }
  
  // Decrypt using Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encryptionKey.buffer as ArrayBuffer,
    { name: "AES-CTR", length: 128 },
    true,
    ["decrypt"]
  );
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-CTR",
      counter: counter.buffer as ArrayBuffer,
      length: 128,
    },
    cryptoKey,
    cipherText.buffer as ArrayBuffer
  );
  
  const result = new TextDecoder().decode(decryptedBuffer);
  console.log("[decrypt] Success! Decrypted length:", result.length);
  return result;
};

export const decryptMessageLocal = async (
  encryptedText: string | number[],
  senderPublicKeyBase58: string,
  recipientPrivateKeyHex: string
): Promise<string> => {
  try {
    console.log("[decryptMessageLocal] Starting decryption", {
      encryptedTextType: Array.isArray(encryptedText) ? "array" : "string",
      encryptedTextLength: Array.isArray(encryptedText) ? encryptedText.length : encryptedText.length,
      senderKey: senderPublicKeyBase58.substring(0, 10) + "...",
      recipientKeyLength: recipientPrivateKeyHex.length,
    });
    
    // Handle array input (from API)
    let cipherTextHex: string;
    if (Array.isArray(encryptedText)) {
      cipherTextHex = Buffer.from(encryptedText).toString("hex");
      console.log("[decryptMessageLocal] Converted array to hex", {
        hexLength: cipherTextHex.length,
        hexPreview: cipherTextHex.substring(0, 40) + "...",
      });
    } else {
      cipherTextHex = encryptedText;
      console.log("[decryptMessageLocal] Using hex string", {
        hexLength: cipherTextHex.length,
        hexPreview: cipherTextHex.substring(0, 40) + "...",
      });
    }
    
    const privateKey = hexToBytes(recipientPrivateKeyHex);
    console.log("[decryptMessageLocal] Private key bytes length:", privateKey.length);
    
    const publicKey = bs58PublicKeyToBytes(senderPublicKeyBase58);
    console.log("[decryptMessageLocal] Public key bytes length:", publicKey.length);
    
    const sharedPrivateKey = getSharedPrivateKey(privateKey, publicKey);
    console.log("[decryptMessageLocal] Shared private key length:", sharedPrivateKey.length);
    
    return await decrypt(sharedPrivateKey, cipherTextHex);
  } catch (e) {
    console.error("[decryptMessageLocal] Decryption failed:", e);
    throw new Error(`Failed to decrypt message: ${e}`);
  }
};


