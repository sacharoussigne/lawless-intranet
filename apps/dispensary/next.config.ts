import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
  experimental: {
    optimizePackageImports: [
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
