/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true, // 🚀 Skip ESLint errors/warnings in build
  },
  env: {
    NEXT_PUBLIC_CONTENTFUL_SPACE_ID: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID,
    NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT: process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT,
    NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN: process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN,
  },
};

module.exports = nextConfig;
