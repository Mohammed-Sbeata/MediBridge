/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Ensure proper handling of dynamic routes
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  // Ensure environment variables are available at build time
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
};

export default config;
