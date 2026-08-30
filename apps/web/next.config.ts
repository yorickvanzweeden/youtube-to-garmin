import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google-cloud/tasks", "google-gax"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@google-cloud/tasks/build/**/*.json",
      "./node_modules/google-gax/build/**/*.json",
      "./node_modules/.pnpm/@google-cloud+tasks@*/node_modules/@google-cloud/tasks/build/**/*.json",
      "./node_modules/.pnpm/google-gax@*/node_modules/google-gax/build/**/*.json",
    ],
  },
  reactCompiler: true,
};

export default nextConfig;
