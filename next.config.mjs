/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Every route in this chassis reads live CRM data; never show a stale
  // number just because a page was visited recently this session.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
