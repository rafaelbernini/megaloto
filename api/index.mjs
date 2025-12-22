import app from './backend-src-proxy.mjs';

// Vercel serverless function entrypoint — delegate to Express app
export default async function handler(req, res) {
  return app(req, res);
}
