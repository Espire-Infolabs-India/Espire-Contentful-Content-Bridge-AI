/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove `swcMinify` if it's invalid, or update to a supported key if needed
  //swcMinify: true,
  env: {
    NEXT_PUBLIC_CONTENTFUL_SPACE_ID: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID,
    NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT: process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT,
    NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN: process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN,
  },
};

module.exports = nextConfig;
