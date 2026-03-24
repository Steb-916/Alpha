/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
  serverExternalPackages: ['ws'],
  experimental: {
    serverComponentsExternalPackages: ['ws'],
  },
};

module.exports = nextConfig;
