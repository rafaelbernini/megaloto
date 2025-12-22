import proxy from './api/backend-src-proxy.mjs';
console.log('proxy default exported type:', typeof proxy);
if (typeof proxy === 'function') console.log('OK: exported a function');
