/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@mariozechner/pi-ai", "pg"],
  },
};

export default nextConfig;
