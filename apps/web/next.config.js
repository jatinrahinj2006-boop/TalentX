/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow calling local FastAPI backend
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:8000/api/v1/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
