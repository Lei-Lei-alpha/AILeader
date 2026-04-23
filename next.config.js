/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'word-extractor', 'tesseract.js'],
  },
}

module.exports = nextConfig
