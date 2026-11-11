import {
  pbkdf2 as derive,
  randomBytes,
  timingSafeEqual,
  webcrypto,
} from "node:crypto";
import { promisify } from "node:util";

const pbkdf2 = promisify(derive);
export const PASSWORD_ITERATIONS = 600_000;
const PREFIX = `pbkdf2-sha256$${PASSWORD_ITERATIONS}$`;

export const generateSecureRandomString = (): string =>
  randomBytes(24).toString("base64url");

export const hashSecret = async (secret: string): Promise<Uint8Array> =>
  new Uint8Array(
    await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
  );

export const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.byteLength === b.byteLength && timingSafeEqual(a, b);

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, PASSWORD_ITERATIONS, 32, "sha256");
  return PREFIX + Buffer.concat([salt, hash]).toString("base64");
};

export const needsPasswordUpgrade = (hash: string): boolean =>
  !hash.startsWith(PREFIX);

// A missing account still performs the same expensive password calculation.
export const verifyPassword = async (
  password: string,
  storedHash: string | null,
): Promise<boolean> => {
  const current = storedHash?.startsWith(PREFIX);
  const legacy = storedHash !== null && !storedHash.includes("$");
  const combined = Buffer.from(
    current ? storedHash!.slice(PREFIX.length) : legacy ? storedHash! : "",
    "base64",
  );
  const wellFormed = combined.length === 48 && (current || legacy);
  const salt = wellFormed ? combined.subarray(0, 16) : Buffer.alloc(16);
  const iterations = wellFormed && legacy ? 100_000 : PASSWORD_ITERATIONS;
  const hash = await pbkdf2(password, salt, iterations, 32, "sha256");
  // Pad legacy verification to the current work factor, including wrong passwords.
  if (iterations < PASSWORD_ITERATIONS) {
    await pbkdf2(
      password,
      salt,
      PASSWORD_ITERATIONS - iterations,
      32,
      "sha256",
    );
  }
  return Boolean(wellFormed && constantTimeEqual(hash, combined.subarray(16)));
};
