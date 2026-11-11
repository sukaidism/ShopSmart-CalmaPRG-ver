const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { createApiEvidence } = require('./api-evidence.cjs');
const frontend = process.env.SMOKE_FRONTEND_URL || 'http://localhost:5173';
const api = process.env.SMOKE_API_URL || 'http://localhost:3000/api';
const evidence = path.resolve('docs/release/evidence');
fs.mkdirSync(evidence, { recursive: true });
const records = [];
async function record(id, startingState, action, expected, run) {
  try {
    const observed = await run();
    records.push({ id, startingState, action, expected, observed, decision: 'PASS' });
    console.log(`${id}: PASS - ${observed}`);
  } catch (error) {
    records.push({ id, startingState, action, expected, observed: error.message, decision: 'FAIL' });
    console.error(`${id}: FAIL - ${error.message}`);
    throw error;
  }
}
(async () => {
  const browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER_CHANNEL || 'msedge', headless: true });
  let fallbackServer;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const request = page.request;
    const captureApi = createApiEvidence(browser, evidence);
    const catalogResponse = await request.get(`${api}/products`);
    assert.equal(catalogResponse.status(), 200);
    const catalogBody = await catalogResponse.json();
    const { products } = catalogBody;
    await captureApi('12-api-products', 'GET', `${api}/products`, null, catalogResponse, catalogBody);
    const product = products.find((p) => p.stock >= 2);
    const unavailable = products.find((p) => p.stock === 0);
    assert.ok(product, 'Need an existing product with at least two units; do not reseed to satisfy this test.');
    const screenshot = async (name) => { await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true }); };
    await record('HEALTH', 'Local API and PostgreSQL running', `Open ${api}/health in browser`, '200 and status ok', async () => {
      const response = await page.goto(`${api}/health`);
      assert.equal(response.status(), 200);
      assert.equal(JSON.parse(await page.locator('body').innerText()).status, 'ok');
      await captureApi('11-api-health', 'GET', `${api}/health`, null, response);
      return 'Browser displayed {"status":"ok"}; HTTP 200.';
    });
    await record('BROWSE', 'Existing catalog, fresh browser session', 'Open frontend; search keyboard; search zz-no-such-product-qa; clear search; open first Details', 'Catalog, relevant search, useful empty state, and product detail', async () => {
      await page.goto(frontend);
      await page.locator('.product-card').first().waitFor();
      assert.equal(await page.locator('.product-card').count(), products.length);
      await screenshot('01-catalog');
      await page.getByLabel('Search products').fill('keyboard');
      await page.waitForResponse((r) => r.url().includes('search=keyboard') && r.status() === 200);
      await page.getByRole('heading', { name: 'Compact Mechanical Keyboard', exact: true }).waitFor();
      await page.getByLabel('Search products').fill('zz-no-such-product-qa');
      await page.getByText('No products match your search or filters.').waitFor();
      await screenshot('02-no-results');
      await page.getByLabel('Search products').fill('');
      await page.locator('.product-card').first().waitFor();
      await page.locator('.product-card').filter({ has: page.getByRole('heading', { name: product.name, exact: true }) }).getByRole('link', { name: 'Details' }).click();
      await page.getByRole('heading', { name: product.name, exact: true }).waitFor();
      return `${products.length} products loaded; keyboard found; absent query showed empty state; ${product.name} detail loaded.`;
    });
    await record('CART', 'Product detail, empty memory cart', `Add ${product.name}; increase to 2; decrease to 1; remove; add again; refresh cart`, 'Accurate totals; removal and intentional refresh reset', async () => {
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
      await page.getByRole('link', { name: 'Cart (1)', exact: true }).click();
      assert.equal(await page.locator('.summary-total strong').innerText(), `₱${product.price.toLocaleString('en-PH')}`);
      await page.getByRole('button', { name: `Increase quantity of ${product.name}`, exact: true }).click();
      assert.equal(await page.locator('.summary-total strong').innerText(), `₱${(product.price * 2).toLocaleString('en-PH')}`);
      await screenshot('03-cart');
      await page.getByRole('button', { name: `Decrease quantity of ${product.name}`, exact: true }).click();
      await page.getByRole('button', { name: 'Remove', exact: true }).click();
      await page.getByRole('heading', { name: 'Your cart is empty' }).waitFor();
      await page.getByRole('link', { name: 'Browse products' }).click();
      await page.locator('.product-card').filter({ has: page.getByRole('heading', { name: product.name, exact: true }) }).getByRole('button', { name: 'Add to cart' }).click();
      await page.getByRole('link', { name: 'Cart (1)', exact: true }).click();
      await page.reload();
      await page.getByRole('heading', { name: 'Your cart is empty' }).waitFor();
      return `Quantity 1 total PHP ${product.price}; quantity 2 total PHP ${product.price*2}; decrease/remove worked; refresh cleared memory cart.`;
    });
    const fictional = { customerName: 'Alexandra Eala', email: 'alexandra.eala@example.test', address: '123 Fictional Street, Demo City' };
    await record('INVALID-CHECKOUT', 'Cart with one product', 'Try empty form in browser; POST invalid email and short address directly', 'Browser refuses; API returns 422 INVALID_ORDER', async () => {
      await page.getByRole('link', { name: 'Browse products' }).click();
      await page.locator('.product-card').filter({ has: page.getByRole('heading', { name: product.name, exact: true }) }).getByRole('button', { name: 'Add to cart' }).click();
      await page.getByRole('link', { name: 'Cart (1)', exact: true }).click();
      await page.getByRole('link', { name: 'Proceed to checkout' }).click();
      await page.getByRole('button', { name: 'Place simulated order' }).click();
      assert.equal(await page.getByLabel('Full name').evaluate((input) => input.validity.valueMissing), true);
      const response = await request.post(`${api}/orders`, { data: { ...fictional, email: 'bad-email', address: 'short', items: [{ productId: product.id, quantity: 1 }] } });
      assert.equal(response.status(), 422);
      const body = await response.json();
      assert.equal(body.error.code, 'INVALID_ORDER');
      await captureApi('16-api-invalid-order', 'POST', `${api}/orders`, { ...fictional, email: 'bad-email', address: 'short', items: [{ productId: product.id, quantity: 1 }] }, response, body);
      return 'Required field blocked browser submission; API HTTP 422 INVALID_ORDER for invalid email/address.';
    });
    await record('STOCK', 'Existing out-of-stock product or above-stock request', 'Inspect disabled purchase control; direct POST unavailable product or stock+1 units (max 20)', 'Disabled button; API 409 INSUFFICIENT_STOCK; no order', async () => {
      const target = unavailable || products.find((p) => p.stock < 20);
      assert.ok(target, 'Need an existing product with stock below 20 for stock rejection.');
      const response = await request.post(`${api}/orders`, { data: { ...fictional, items: [{ productId: target.id, quantity: target.stock + 1 }] } });
      const body = await response.json();
      assert.equal(response.status(), 409);
      assert.equal(body.error.code, 'INSUFFICIENT_STOCK');
      await captureApi('17-api-stock-rejection', 'POST', `${api}/orders`, { ...fictional, items: [{ productId: target.id, quantity: target.stock + 1 }] }, response, body);
      if (unavailable) {
        const stockPage = await browser.newPage();
        await stockPage.goto(`${frontend}/products/${target.id}`);
        await stockPage.getByRole('heading', { name: target.name, exact: true }).waitFor();
        assert.equal(await stockPage.getByRole('button', { name: 'Add to cart' }).isDisabled(), true);
        await stockPage.screenshot({ path: path.join(evidence, '04-stock.png'), fullPage: true });
        await stockPage.close();
      }
      return `${target.name} stock ${target.stock}; quantity ${target.stock+1} returned HTTP 409 ${body.error.code}: ${body.error.message}`;
    });
    await record('CHECKOUT', 'One cart unit; no successful order in this run', 'Fill Alexandra Eala, alexandra.eala@example.test, 123 Fictional Street, Demo City; submit once', 'One 201 order; server total equals catalog price; cart cleared; stock decrements once', async () => {
      await page.getByLabel('Full name').fill(fictional.customerName);
      await page.getByLabel('Email address').fill(fictional.email);
      await page.getByLabel('Delivery address').fill(fictional.address);
      const responsePromise = page.waitForResponse((r) => r.url() === `${api}/orders` && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Place simulated order' }).click();
      const response = await responsePromise;
      const body = await response.json();
      assert.equal(response.status(), 201);
      assert.equal(body.total, product.price);
      await captureApi('18-api-order-created', 'POST', `${api}/orders`, { ...fictional, items: [{ productId: product.id, quantity: 1 }] }, response, body);
      await page.getByRole('heading', { name: 'Thank you, Alexandra Eala!' }).waitFor();
      await page.getByRole('link', { name: 'Cart (0)', exact: true }).waitFor();
      const current = await (await request.get(`${api}/products/${product.id}`)).json();
      assert.equal(current.stock, product.stock - 1);
      await screenshot('05-order-confirmation');
      return `HTTP 201; order #${body.id}; total PHP ${body.total}; cart 0; product #${product.id} stock ${product.stock} -> ${current.stock}.`;
    });
    await page.getByRole('link', { name: 'AI Assistant', exact: true }).click();
    await record('ASSISTANT', 'Assistant page; current catalog', 'Ask wireless mouse under PHP 700; inspect answer and click catalog source', 'Eligible current product, correct price, linked record; controlled fallback allowed', async () => {
      await page.getByLabel('Your question').fill('wireless mouse under PHP 700');
      const responsePromise = page.waitForResponse((r) => r.url() === `${api}/assistant/questions`);
      await page.getByRole('button', { name: 'Ask ShopSmart' }).click();
      const response = await responsePromise; const body = await response.json();
      assert.equal(response.status(), 200);
      await page.getByRole('button', { name: 'Ask ShopSmart', exact: true }).waitFor();
      assert.ok(body.sources.length > 0);
      await captureApi('19-api-assistant', 'POST', `${api}/assistant/questions`, { question: 'wireless mouse under PHP 700' }, response, body);
      for (const p of body.recommendedProducts) {
        const current = await (await request.get(`${api}/products/${p.id}`)).json();
        assert.equal(p.price, current.price); assert.ok(current.stock > 0); assert.ok(p.price <= 700);
        assert.ok(body.sources.some((s) => s.id === p.id));
      }
      await screenshot('06-assistant');
      await page.locator('details').getByRole('link').first().click();
      await page.getByRole('heading', { name: body.recommendedProducts[0].name, exact: true }).waitFor();
      await page.getByRole('link', { name: 'AI Assistant', exact: true }).click();
      return `HTTP 200; mode ${body.mode}; ${body.answer}; source link opened current product.`;
    });
    await record('NO-MATCH', 'Assistant page', 'Ask Do you sell a drone?', 'Honest no match, no sources/recommendations, loading ends', async () => {
      await page.getByLabel('Your question').fill('Do you sell a drone?');
      const responsePromise=page.waitForResponse((r)=>r.url()===`${api}/assistant/questions`);
      await page.getByRole('button',{name:'Ask ShopSmart'}).click();
      const noMatchResponse=await responsePromise;
      const body=await noMatchResponse.json();
      await captureApi('20-api-assistant-no-match', 'POST', `${api}/assistant/questions`, { question: 'Do you sell a drone?' }, noMatchResponse, body);
      assert.equal(body.mode,'no-match'); assert.deepEqual(body.sources,[]); assert.deepEqual(body.recommendedProducts,[]);
      await page.getByText('I could not find an in-stock product matching that request.').waitFor();
      await screenshot('07-no-match');
      return 'HTTP 200 no-match; honest message; sources and recommendations empty.';
    });
    await record('API-FAILURE', 'Assistant page; browser API requests can be intercepted', 'Abort assistant request in browser, submit mouse; then abort product requests and open home', 'Useful error, enabled submit button, no endless loading; catalog offers backend guidance', async () => {
      await page.route(`${api}/assistant/questions`, (route) => route.abort('failed'));
      await page.getByLabel('Your question').fill('mouse');
      await page.getByRole('button', { name: 'Ask ShopSmart' }).click();
      await page.getByText('Failed to fetch', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Ask ShopSmart' }).isEnabled(), true);
      await screenshot('08-assistant-network-failure');
      await page.unroute(`${api}/assistant/questions`);
      await page.route(`${api}/products`, (route) => route.abort('failed'));
      await page.getByRole('link', { name: 'Products', exact: true }).click();
      await page.getByText('Failed to fetch Make sure the backend is running.').waitFor();
      assert.equal(await page.getByText('Loading products…').count(), 0);
      await screenshot('09-catalog-network-failure');
      await page.unroute(`${api}/products`);
      return 'Assistant displayed Failed to fetch and re-enabled submit; catalog ended loading and displayed backend guidance. Browser route abort simulated API outage; live server remained running.';
    });
    await record('PROVIDER-FAILURE', 'Separate local API on 3001 with empty provider key, same database', 'Start API with GEMINI_API_KEY empty; route browser assistant request to that API; ask mouse', '200 rules fallback, notice, source links, loading ends', async () => {
      // An empty inherited key prevents dotenv from loading the real key in this child.
      fallbackServer=spawn(process.execPath,['src/server.js'],{cwd:path.resolve('backend'),env:{...process.env,PORT:'3001',GEMINI_API_KEY:''},stdio:'ignore',windowsHide:true});
      let ready=false;
      for(let attempt=0;attempt<40;attempt++) {
        try { const r=await request.get('http://localhost:3001/api/health'); if(r.ok()){ready=true;break;} } catch {}
        await new Promise((resolve)=>setTimeout(resolve,250));
      }
      assert.ok(ready,'Isolated fallback API did not start');
      await page.getByRole('link',{name:'AI Assistant',exact:true}).click();
      let body;
      await page.route(`${api}/assistant/questions`,async(route)=>{
        const response=await request.post('http://localhost:3001/api/assistant/questions',{data:{question:'mouse'}});
        body=await response.json();
        await captureApi('22-api-provider-fallback', 'POST', 'http://localhost:3001/api/assistant/questions', { question: 'mouse' }, response, body);
        await route.fulfill({response});
      });
      await page.getByLabel('Your question').fill('mouse');
      await page.getByRole('button',{name:'Ask ShopSmart'}).click();
      await page.getByText('The AI helper is unavailable right now, so this answer comes from catalog rules.').waitFor();
      assert.equal(body.mode,'rules'); assert.ok(body.sources.length>0);
      assert.equal(await page.getByRole('button',{name:'Ask ShopSmart'}).isEnabled(),true);
      await screenshot('10-provider-fallback');
      return 'Real API with missing provider key returned HTTP 200 rules fallback, catalog sources and visible notice. No key was modified on disk.';
    });
    await record('API-ENDPOINTS', 'Local API and existing catalog', 'GET search, product detail, invalid product ID, missing product; POST invalid assistant question', 'HTTP 200, 200, 400, 404 and 422 with captured response screenshots', async () => {
      const cases = [
        ['13-api-product-search', 'GET', api + '/products?search=keyboard', null, 200],
        ['14-api-product-details', 'GET', api + '/products/' + product.id, null, 200],
        ['15-api-invalid-product-id', 'GET', api + '/products/invalid', null, 400],
        ['23-api-product-not-found', 'GET', api + '/products/2147483647', null, 404],
        ['21-api-invalid-question', 'POST', api + '/assistant/questions', {question:'x'}, 422]
      ];
      for(const [name,method,url,data,expectedStatus] of cases) {
        const response=method==='GET' ? await request.get(url) : await request.post(url,{data});
        assert.equal(response.status(),expectedStatus);
        await captureApi(name,method,url,data,response);
      }
      return 'Search/detail returned 200; invalid product ID 400; missing product 404; invalid question 422. Thirteen API request/response screenshots and raw JSON captured across this run.';
    });

  } finally {
    if(fallbackServer) fallbackServer.kill();
    await browser.close();
    fs.writeFileSync(path.join(evidence,'browser-smoke.json'),JSON.stringify({date:new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila'}),frontend,api,records},null,2));
  }
})().catch((error)=>{console.error(error.message);process.exitCode=1;});
