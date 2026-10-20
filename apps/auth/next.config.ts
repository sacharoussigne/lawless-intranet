import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.join(__dirname, '../..');

const nextConfig: NextConfig = {
  output: 'standalone',
  // Dev on subdomains (docs/SSO-DEV.md): the dev server serves its assets and HMR to these hosts.
  allowedDevOrigins: ['*.localhost', '*.lawless.localhost'],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  serverExternalPackages: [
    'pg',
    '@prisma/client',
    '@prisma/client-runtime-utils',
    '@prisma/adapter-pg',
  ],
};

export default nextConfig;
