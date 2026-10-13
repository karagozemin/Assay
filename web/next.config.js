const { validateProductionEnv } = require("./config/validate-env.cjs");

if (process.env.NODE_ENV === "production") {
  validateProductionEnv(process.env);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NEXT_PUBLIC_* values are embedded at build time. Production builds fail above
  // if either service URL is missing, local, or an ephemeral trycloudflare origin.
};

module.exports = nextConfig;
