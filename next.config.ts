import type { NextConfig } from 'next'
import { mergeContentSecurityPolicy } from './lib/simulations/csp'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: mergeContentSecurityPolicy(),
          },
        ],
      },
    ]
  },
}

export default nextConfig
