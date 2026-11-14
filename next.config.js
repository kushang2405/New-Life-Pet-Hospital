/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Proxy API calls to the Express backend (port 3001 by default)
    const target = process.env.API_TARGET || `http://localhost:${process.env.API_PORT || 3001}`;

    return [
      {
        source: '/api/:path*',
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
