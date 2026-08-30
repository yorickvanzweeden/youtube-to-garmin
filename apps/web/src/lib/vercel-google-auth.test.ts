import { describe, expect, it, vi } from "vitest";

const { writeFileSync } = vi.hoisted(() => ({ writeFileSync: vi.fn() }));
vi.mock("node:fs", () => ({ writeFileSync }));

import { configureVercelGoogleAuth } from "./vercel-google-auth";

describe("configureVercelGoogleAuth", () => {
  it("leaves local ADC untouched when Vercel credentials are absent", () => {
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    vi.stubEnv("GCP_PROJECT_NUMBER", "");
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    configureVercelGoogleAuth();

    expect(writeFileSync).not.toHaveBeenCalled();
    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
  });

  it("writes external-account credentials for Vercel OIDC", () => {
    vi.stubEnv("VERCEL_OIDC_TOKEN", "jwt");
    vi.stubEnv("GCP_PROJECT_NUMBER", "123");
    vi.stubEnv("GCP_PROJECT_ID", "project");
    vi.stubEnv(
      "CLOUD_RUN_SERVICE_ACCOUNT",
      "runtime@project.iam.gserviceaccount.com",
    );

    configureVercelGoogleAuth();

    expect(writeFileSync).toHaveBeenCalledTimes(2);
    const credentialWrite = writeFileSync.mock.calls[1];
    const credentials = JSON.parse(credentialWrite[1]);
    expect(credentials.audience).toContain("projects/123/");
    expect(credentials.credential_source.format.type).toBe("text");
    expect(process.env.GOOGLE_CLOUD_PROJECT).toBe("project");
  });
});
