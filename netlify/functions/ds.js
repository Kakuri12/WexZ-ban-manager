// netlify/functions/ds.js
// Serverless proxy — รับ request จากเว็บ ส่งต่อไป Roblox Open Cloud API
// ทำงานบน Netlify server ไม่โดน CORS

const https = require('https');

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { method, universeId, apiKey, dsName, entryKey, body } = payload;

  if (!universeId || !apiKey || !dsName || !method) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const base = `/datastores/v1/universes/${universeId}/standard-datastores/datastore/entries`;
  let path, httpMethod, reqBody;

  if (method === 'LIST') {
    path       = `${base}?datastoreName=${encodeURIComponent(dsName)}&prefix=ban_&limit=100`;
    httpMethod = 'GET';
  } else if (method === 'GET') {
    path       = `${base}/entry?datastoreName=${encodeURIComponent(dsName)}&entryKey=${encodeURIComponent(entryKey)}`;
    httpMethod = 'GET';
  } else if (method === 'POST') {
    path       = `${base}/entry?datastoreName=${encodeURIComponent(dsName)}&entryKey=${encodeURIComponent(entryKey)}`;
    httpMethod = 'POST';
    reqBody    = JSON.stringify(body || {});
  } else if (method === 'DELETE') {
    path       = `${base}/entry?datastoreName=${encodeURIComponent(dsName)}&entryKey=${encodeURIComponent(entryKey)}`;
    httpMethod = 'DELETE';
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown method: ' + method }) };
  }

  const reqHeaders = { 'x-api-key': apiKey };
  if (reqBody) {
    reqHeaders['Content-Type']   = 'application/json';
    reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
  }

  try {
    const result = await httpsRequest(
      { hostname: 'apis.roblox.com', port: 443, path, method: httpMethod, headers: reqHeaders },
      reqBody
    );
    return { statusCode: result.status, headers, body: result.body || '{}' };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Upstream error: ' + e.message }) };
  }
};
