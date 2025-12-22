import handler from './megasena.mjs';

function makeReq(url) {
  return { url, method: 'GET', headers: {} };
}

function makeRes() {
  let body = '';
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    end(chunk) { body += chunk || ''; this._body = body; },
    getBody() { return this._body; }
  };
}

async function run() {
  const req = makeReq('/api/megasena/history');
  const res = makeRes();
  await handler(req, res);
  console.log('RESPONSE BODY:');
  console.log(res.getBody().slice(0, 2000)); // print head
}

run().catch((e) => { console.error(e); process.exit(1); });
