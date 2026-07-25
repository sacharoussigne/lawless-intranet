import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.join(__dirname, '../..');

const nextConfig: NextConfig = {
  output: 'standalone',
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
  experimental: {
    optimizePackageImports: [
      '@lawless-intranet/mail-template-engine',
      '@lawless-intranet/mail-template-ui',
      '@lawless-intranet/agenda-ui',
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/dates',
      '@mantine/form',
      '@mantine/modals',
      '@mantine/notifications',
      '@mantine/nprogress',
      '@mantine/dropzone',
      '@mantine/charts',
      '@tabler/icons-react',
    ],
  },
};

export default nextConfig;
