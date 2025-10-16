/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Docker 部署优化
  images: {
    domains: ['localhost'],
  },
}

module.exports = nextConfig
