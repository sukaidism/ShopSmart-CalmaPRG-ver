const fs = require('node:fs');
const path = require('node:path');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Screenshots show real captured requests/responses in an evidence viewer.
// They are not mocked API results or screenshots of an API client application.
function createApiEvidence(browser, directory) {
  const entries = [];
  return async function captureApi(name, method, url, requestBody, response, responseBody) {
    const body = responseBody === undefined ? await response.json() : responseBody;
    const entry = {
      screenshot: `${name}.png`,
      capturedAt: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
      method, url, status: response.status(), requestBody: requestBody ?? null, responseBody: body
    };
    entries.push(entry);
    fs.writeFileSync(path.join(directory, 'api-responses.json'), JSON.stringify({
      description: 'Real local API responses captured during the smoke run. Screenshots use a plain evidence viewer showing method, URL, status, request and unmodified JSON body.', entries
    }, null, 2));
    const page = await browser.newPage({ viewport: { width: 1120, height: 900 } });
    try {
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
        *{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#172033;font:17px Arial,sans-serif}
        main{margin:28px;padding:30px;background:white;border:1px solid #cbd5e1;border-radius:12px}
        h1{font-size:25px;margin:8px 0 18px}h2{font-size:19px;margin:26px 0 12px}
        .label{color:#526276;font-size:14px} .method{font-weight:bold;color:#0f766e}
        .url{overflow-wrap:anywhere;margin:12px 0;font:17px Consolas,monospace}
        .status{display:inline-block;background:${entry.status < 400 ? '#dcfce7' : '#fff1f2'};padding:10px 14px;border-radius:6px;font-weight:bold}
        pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;background:#f8fafc;border:1px solid #dce3ec;padding:18px;border-radius:8px;font:16px/1.5 Consolas,monospace}
      </style></head><body><main>
        <div class="label">SHOPSMART · LOCAL API EVIDENCE · CAPTURED RESPONSE</div>
        <h1>${escapeHtml(name.replace(/^\d+-api-/, '').replaceAll('-', ' '))}</h1>
        <div class="url"><span class="method">${escapeHtml(method)}</span> ${escapeHtml(url)}</div>
        <div class="status">HTTP ${entry.status}</div>
        <p class="label">${escapeHtml(entry.capturedAt)} · Asia/Manila · Fictional checkout data only</p>
        <h2>Request body</h2><pre>${escapeHtml(requestBody == null ? 'No request body (GET request).' : JSON.stringify(requestBody, null, 2))}</pre>
        <h2>Response body</h2><pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre>
        <p class="label">Evidence viewer. JSON above is the unmodified response from the local API. No credentials or authorization headers are displayed.</p>
      </main></body></html>`);
      await page.screenshot({ path: path.join(directory, entry.screenshot), fullPage: true });
    } finally { await page.close(); }
  };
}
module.exports = { createApiEvidence };
