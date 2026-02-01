import { webcrypto } from "crypto";

const crypto = webcrypto as Crypto;

// Alphabet without ambiguous characters (no 0, O, 1, l, I)
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

// Generates a cryptographically secure random string with 120+ bits of entropy
export const generateSecureRandomString = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += ALPHABET[bytes[i] >> 3];
  }
  return result;
};

// Hashes a secret using SHA-256
export const hashSecret = async (secret: string): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
};

// Constant-time comparison to prevent timing attacks
export const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.byteLength !== b.byteLength) return false;
  let c = 0;
  for (let i = 0; i < a.byteLength; i++) {
    c |= a[i] ^ b[i];
  }
  return c === 0;
};

// Hashes a password using PBKDF2 with a random salt
export const hashPassword = async (password: string): Promise<string> => {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    256,
  );

  // Combine salt and hash, encode as base64
  const combined = new Uint8Array(salt.length + hash.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(hash), salt.length);
  return Buffer.from(combined).toString("base64");
};

// Verifies a password against a stored hash
export const verifyPassword = async (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  const combined = Buffer.from(storedHash, "base64");
  const salt = combined.subarray(0, 16);
  const hash = combined.subarray(16);

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const newHash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    256,
  );

  return constantTimeEqual(new Uint8Array(newHash), new Uint8Array(hash));
};
