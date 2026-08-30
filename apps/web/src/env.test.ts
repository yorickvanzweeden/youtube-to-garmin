import { afterEach, describe, expect, it, vi } from "vitest";

import { getEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("runtime environment", () => {
  it("requires the session secret", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("BOOTSTRAP_GOOGLE_EMAIL", "owner@example.com");

    expect(() => getEnv()).toThrow("AUTH_SECRET is required");
  });

  it("requires an owner allowlist or bootstrap email", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("AUTH_SECRET", "auth-secret");
    vi.stubEnv("ALLOWED_GOOGLE_SUB", "");
    vi.stubEnv("BOOTSTRAP_GOOGLE_EMAIL", "");

    expect(() => getEnv()).toThrow(
      "ALLOWED_GOOGLE_SUB or BOOTSTRAP_GOOGLE_EMAIL is required",
    );
  });

  it("accepts the temporary bootstrap configuration", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("AUTH_SECRET", "auth-secret");
    vi.stubEnv("BOOTSTRAP_GOOGLE_EMAIL", "owner@example.com");

    expect(getEnv().bootstrapGoogleEmail).toBe("owner@example.com");
  });
});
