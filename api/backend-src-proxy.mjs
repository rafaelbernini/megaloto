import app from '../backend/src/index.js';

// Re-export the express app as default for the serverless wrapper
export default function (req, res) {
  return app(req, res);
}
