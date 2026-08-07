import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * `standalone` emits .next/standalone with a server.js and only the
   * dependencies actually reached, which is what the Dockerfile copies into
   * its runtime image.
   *
   * Vercel builds its own output format and does not want it, so the option
   * is switched off there. VERCEL is set by the platform on every build.
   * Leaving it on would have Next produce a server entrypoint nothing runs,
   * for a deployment that never reads it.
   */
  output: process.env.VERCEL ? undefined : 'standalone',
};

export default nextConfig;
