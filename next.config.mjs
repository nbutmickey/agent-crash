/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@mariozechner/pi-ai", "better-sqlite3"],
  },
};

export default nextConfig;
