import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /*
   * `I:` es una unidad de red en FAT32: las escrituras concurrentes que hace
   * Next al compilar fallan con EINVAL, igual que npm install. NEXT_DIST_DIR
   * permite compilar contra una carpeta local sin mover el proyecto:
   *   $env:NEXT_DIST_DIR = "$env:TEMP\cdh-next"; npm run build
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // El dashboard consulta vistas analiticas; mantener el payload pequeno.
    optimizePackageImports: ['@prisma/client'],
    serverActions: { bodySizeLimit: '26mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
