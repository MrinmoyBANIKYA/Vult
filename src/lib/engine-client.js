/**
 * Calls to the local Vult engine (server/index.js). In development Vite proxies /engine to it;
 * `npm run start` serves the app and the engine from one port.
 */
export function engineClient(base = '/engine') {
  const call = async (method, path, body) => {
    let response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw Object.assign(new Error('The Vult engine is not running. Start it with `npm run engine`.'), {
        offline: true
      });
    }
    // The dev proxy answers 502/504 with an HTML page when the engine is down.
    const isJson = /json/i.test(response.headers.get('content-type') || '');
    const data = isJson ? await response.json() : null;
    if (!isJson)
      throw Object.assign(new Error('The Vult engine is not running. Start it with `npm run engine`.'), {
        offline: true
      });
    if (!response.ok)
      throw Object.assign(new Error(data?.error || `Engine error ${response.status}`), { status: response.status });
    return data;
  };
  return {
    health: () => call('GET', '/health'),
    settings: () => call('GET', '/settings'),
    saveSettings: settings => call('PUT', '/settings', settings),
    models: provider => call('GET', `/models?provider=${encodeURIComponent(provider)}`),
    test: () => call('POST', '/test', {}),
    mapRows: (statement, rows) => call('POST', '/map-rows', { statement, rows }),
    narrative: input => call('POST', '/narrative', input),
    recalc: (xlsxBase64, cells) => call('POST', '/recalc', { xlsx: xlsxBase64, cells }),
    quote: symbol => call('GET', `/market/quote?symbol=${encodeURIComponent(symbol)}`),
    beta: symbol => call('GET', `/market/beta?symbol=${encodeURIComponent(symbol)}`),
    riskFree: country => call('GET', `/market/riskfree?country=${encodeURIComponent(country)}`),
    fundamentals: ticker => call('GET', `/market/fundamentals?ticker=${encodeURIComponent(ticker)}`),
    peer: ticker => call('GET', `/market/peer?ticker=${encodeURIComponent(ticker)}`),
    fx: (from, to) => call('GET', `/market/fx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    listRuns: () => call('GET', '/runs'),
    getRun: id => call('GET', `/runs/${encodeURIComponent(id)}`),
    saveRun: (id, body) => call('PUT', `/runs/${encodeURIComponent(id)}`, body),
    saveRunPdf: (id, bytes) => call('PUT', `/runs/${encodeURIComponent(id)}/pdf`, { pdf: toBase64(bytes) }),
    deleteRun: id => call('DELETE', `/runs/${encodeURIComponent(id)}`),
    async getRunPdf(id) {
      const response = await fetch(`${base}/runs/${encodeURIComponent(id)}/pdf`);
      if (!response.ok)
        throw Object.assign(new Error('The PDF for this run is not saved'), { status: response.status });
      return new Uint8Array(await response.arrayBuffer());
    }
  };
}

export const engine = engineClient();

export function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  if (globalThis.Buffer) return globalThis.Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
