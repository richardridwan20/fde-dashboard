/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel functions cap request bodies at ~4.5 MB. A higher number here cannot
  // raise that; it just moves the failure to an opaque platform rejection.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
