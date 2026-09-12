/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
};

export default nextConfig;