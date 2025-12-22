import http from 'http';
import handler from './megasena.mjs';

const port = process.env.PORT || 3002;

const server = http.createServer((req, res) => {
  // Simple wrapper so we can test the serverless handler locally
  handler(req, res).catch((err) => {
    console.error('Dev handler error', err);
    res.statusCode = 500;
    res.end('error');
  });
});

server.listen(port, () => console.log(`Dev API server listening on http://localhost:${port}`));
