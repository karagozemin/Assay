/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Backend (registry/ledger) and agent (SSE) base URLs are read at runtime from
  // NEXT_PUBLIC_* env vars so the same build deploys against local or hosted services.
};

module.exports = nextConfig;
