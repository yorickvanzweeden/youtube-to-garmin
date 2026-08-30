import { createHash, randomBytes, randomUUID } from "node:crypto";

export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createPairing() {
  const secret = randomBytes(32).toString("base64url");
  const code = randomIntCode();
  return {
    id: randomUUID(),
    secret,
    secretHash: digest(secret),
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
}

export function createDeviceToken() {
  const token = `gdev_${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: digest(token) };
}

function randomIntCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}
