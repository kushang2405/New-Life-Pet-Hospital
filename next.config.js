/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // During local development, proxy API calls through Next.js to the
    // deployed Netlify API. The browser stays on localhost, avoiding CORS.
    if (process.env.NODE_ENV !== 'development') return [];

    return [
      {
        source: '/api/:path*',
            destination: `${process.env.APP_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
