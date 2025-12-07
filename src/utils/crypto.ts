import { ec as EC } from "elliptic";
import bs58check from "bs58check";
import * as Random from "expo-crypto";
import { Buffer } from "buffer";

// DeSo uses secp256k1 curve
const ec = new EC("secp256k1");

export interface AccessGroupKeyPair {
  seedHex: string;
  privateKeyHex: string;
  publicKeyBase58Check: string;
}

/**
 * Generates a new Access Group Key Pair.
 * DeSo uses the same key format for Access Groups as for Users (secp256k1).
 *
 * Note: In a real production app, you might want to derive this from the user's seed phrase
 * deterministically (e.g. using a different derivation path), but for a standalone
 * Access Group that is just a key pair, random generation is fine as long as the
 * Private Key is securely encrypted and stored (which we do by sending it to members).
 *
 * Actually, for Access Groups, we just need a key pair. The private key is shared
 * among members via encryption.
 */
export const generateAccessGroupKeyPair = async (): Promise<AccessGroupKeyPair> => {
  // Generate random 32 bytes for seed/private key
  const randomBytes = await Random.getRandomBytesAsync(32);
  const seedHex = Buffer.from(randomBytes).toString("hex");

  // Generate key pair from seed
  const keyPair = ec.keyFromPrivate(seedHex);

  // Get Private Key Hex
  const privateKeyHex = keyPair.getPrivate("hex").padStart(64, "0");

  // Get Public Key (compressed)
  const publicKeyPoint = keyPair.getPublic(true, "array"); // compressed = true, encoding = array
  const publicKeyBuffer = Buffer.from(publicKeyPoint);

  // Convert to Base58Check
  // DeSo Public Keys start with [0xcd, 0x14, 0x00] prefix?
  // Actually, DeSo Public Key format:
  // Prefix: 3 bytes
  // Public Key: 33 bytes (compressed)
  // Checksum: 4 bytes

  // The prefix for mainnet is [0xcd, 0x14, 0x00] => 'BC'
  // But wait, bs58check handles checksum. We just need the payload with prefix.
  // Prefix for mainnet public key is [0xcd, 0x14, 0x00]

  const prefix = Buffer.from([0xcd, 0x14, 0x00]);
  const payload = Buffer.concat([prefix, publicKeyBuffer]);

  const publicKeyBase58Check = bs58check.encode(payload);

  return {
    seedHex,
    privateKeyHex,
    publicKeyBase58Check,
  };
};

/**
 * Encrypts the Access Group Private Key for a member.
 * We use the DeSo Identity / ECIES scheme.
 *
 * However, since we are doing this client side without the full Identity context for arbitrary keys,
 * we will rely on `identity.encryptMessage` from `deso-protocol` for the actual encryption
 * IF we are the owner sending it.
 *
 * But wait, `identity.encryptMessage` encrypts FROM the logged in user TO the recipient.
 * The `EncryptedKey` field in `add-access-group-members` expects the key to be encrypted
 * such that the MEMBER can decrypt it.
 * The Member decrypts using their Private Key + The Sender's Public Key.
 * Who is the Sender? The Access Group Owner (current user).
 * So yes, `identity.encryptMessage(recipientPublicKey, accessGroupPrivateKey)`
 * will work perfectly. It produces a hex string that the recipient can decrypt
 * using `shared_secret(recipient_priv, owner_pub)`.
 */
