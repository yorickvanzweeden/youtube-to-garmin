import { describe, expect, it } from "vitest";

import { createDeviceToken, createPairing, digest } from "./pairing";

describe("pairing credentials", () => {
  it("creates a six-digit pairing code and matching secret digest", () => {
    const pairing = createPairing();

    expect(pairing.code).toMatch(/^\d{6}$/);
    expect(pairing.secretHash).toBe(digest(pairing.secret));
    expect(pairing.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("creates a prefixed device token with a matching digest", () => {
    const device = createDeviceToken();

    expect(device.token).toMatch(/^gdev_[A-Za-z0-9_-]+$/);
    expect(device.tokenHash).toBe(digest(device.token));
  });
});
