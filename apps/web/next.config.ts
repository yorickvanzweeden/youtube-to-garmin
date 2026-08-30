import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google-cloud/tasks", "google-gax"],
  reactCompiler: true,
};

export default nextConfig;
