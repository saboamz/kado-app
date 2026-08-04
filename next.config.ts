import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone with only the dependencies actually reached, so
  // the runtime image needs no node_modules copied into it.
  output: 'standalone',
};

export default nextConfig;
