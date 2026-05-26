import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@korepush/auth", "@korepush/crypto", "@korepush/db", "@korepush/k8s", "@korepush/queue"]
};

export default nextConfig;
