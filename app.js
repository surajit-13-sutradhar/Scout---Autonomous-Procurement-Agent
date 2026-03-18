// ─── Architecture note ─────────────────────────────────────────────────────────
// TinyFish's API endpoint (agent.tinyfish.ai) does not send CORS headers, so
// direct fetch() calls from a browser are blocked. The correct architecture is:
//
//   Browser → POST /proxy/tinyfish (your backend) → TinyFish API
//
// This app includes a built-in proxy shim that can run locally via the companion
// server.js file (included at the bottom of this script as a comment).
//
// For demo/development: we detect CORS errors and clearly explain the setup.
// For production: deploy server.js (Express) and set PROXY_URL below.
// ──────────────────────────────────────────────────────────────────────────────

// const PROXY_URL = 'http://localhost:3000/api/tinyfish'; // Change to your deployed proxy URL
const PROXY_URL = '/api/tinyfish'; // Change to your deployed proxy URL

// ─── State ────────────────────────────────────────────────────
const jobs = [];
let activeId = null;

const templates = {
    office: { product: 'HP 26A Black LaserJet Toner Cartridge (CF226A)', qty: '24 units', budget: '₹18,000', sites: ['Amazon India', 'Flipkart'], instructions: 'Genuine HP only, no compatible/refill. Look for case/bulk pricing.' },
    electronics: { product: 'USB-C to USB-A braided cable 3ft 60W', qty: '100 units', budget: '₹50,000', sites: ['Amazon India', 'Flipkart'], instructions: 'Must support 60W charging. Note brand and warranty.' },
    packaging: { product: 'Corrugated shipping box 6x4x4 inches', qty: '500 units', budget: '₹15,000', sites: ['Amazon India', 'Flipkart'], instructions: 'Corrugated cardboard only. Note per-unit price at bundle sizes.' },
    saas: { product: 'Project management software annual plan', qty: '25 seats', budget: '₹2,00,000/yr', sites: ['https://asana.com', 'https://monday.com', 'https://linear.app', 'https://clickup.com'], instructions: 'Extract price per seat per year. Note features in each tier.' }
};

function loadTpl(k) {
    const t = templates[k];
    set('product', t.product); set('qty', t.qty); set('budget', t.budget); set('instructions', t.instructions);
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', t.sites.some(s => s === c.textContent.trim() || s === c.dataset.url)));
}
function set(id, val) { document.getElementById(id).value = val; }
function toggleChip(el) { el.classList.toggle('on'); }
function getSites() { return [...document.querySelectorAll('.chip.on')].map(c => ({ name: c.textContent.trim(), url: c.dataset.url })); }

// ─── Job lifecycle ─────────────────────────────────────────────
function mkJob(cfg) {
    const id = Date.now().toString();
    const job = {
    id, cfg, status: 'running', startTime: Date.now(), endTime: null,
    streams: cfg.sites.map(s => ({ site: s.name, url: s.url, status: 'pending', logs: [], result: null, controller: null })),
    results: [], insight: null
    };
    jobs.unshift(job);
    renderSidebar();
    return job;
}

function renderSidebar() {
    const el = document.getElementById('job-list');
    if (!jobs.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--ink3);font-family:var(--mono)">No jobs yet</div>';
    return;
    }
    el.innerHTML = jobs.map(j => `
    <div class="jc ${j.id === activeId ? 'active' : ''}" onclick="showJob('${j.id}')">
    <div class="jcn">${esc(j.cfg.product.slice(0, 34))}${j.cfg.product.length > 34 ? '…' : ''}</div>
    <div class="jcm"><span class="dot ${j.status}"></span>${j.status} · ${j.cfg.sites.length} sites</div>
    </div>`).join('');
}

function showJob(id) {
    activeId = id;
    renderSidebar(); renderJob(jobs.find(j => j.id === id));
}

// ─── Main render ───────────────────────────────────────────────
function renderJob(job) {
    const area = document.getElementById('results');
    const elapsed = job.endTime ? ((job.endTime - job.startTime) / 1000).toFixed(1) : null;

    const streamsHtml = job.streams.map((s, i) => {
    const pct = { done: 100, running: 55, error: 100, pending: 0 }[s.status] || 0;
    const logHtml = s.logs.length
        ? s.logs.map(l => `<div class="ll"><span class="lt">${l.time}</span><span class="lm ${l.type}">${esc(l.msg)}</span></div>`).join('')
        : '<span style="color:var(--ink3)">Waiting…</span>';
    return `<div class="sc" id="sc-${job.id}-${i}">
    <div class="sh"><span class="dot ${s.status === 'pending' ? 'idle' : s.status}"></span><span class="ss2">${esc(s.site)}</span><span class="su">${esc(s.url)}</span></div>
    <div class="pw"><div class="pb2 ${s.status === 'done' ? 'done' : ''}" style="width:${pct}%"></div></div>
    <div class="slog" id="log-${job.id}-${i}">${logHtml}</div>
</div>`;
    }).join('');

    const valid = job.results.filter(r => r.price != null);
    const prices = valid.map(r => r.price);
    const minP = prices.length ? Math.min(...prices) : null;
    const maxP = prices.length ? Math.max(...prices) : null;
    const savPct = (minP && maxP && minP !== maxP) ? ((1 - minP / maxP) * 100).toFixed(0) : null;

    const priceHtml = job.results.length ? `
<div class="fi3" style="margin-bottom:13px">
    <div class="secl">Price Intelligence</div>
    <div class="sg">
    <div class="scard"><div class="slbl">Lowest</div><div class="sval g">${minP != null ? '₹' + minP.toLocaleString('en-IN') : '—'}</div></div>
    <div class="scard"><div class="slbl">Highest</div><div class="sval a">${maxP != null ? '₹' + maxP.toLocaleString('en-IN') : '—'}</div></div>
    <div class="scard"><div class="slbl">Savings</div><div class="sval">${savPct ? savPct + '%' : '—'}</div></div>
    <div class="scard"><div class="slbl">Scraped</div><div class="sval">${job.streams.filter(s => s.status === 'done').length}/${job.streams.length}</div></div>
    ${elapsed ? `<div class="scard"><div class="slbl">Time</div><div class="sval">${elapsed}s</div></div>` : ''}
    </div>
    <div class="pt"><table>
    <thead><tr><th>Source</th><th>Product match</th><th>Price</th><th>Availability</th><th>Notes</th></tr></thead>
    <tbody>${job.results.map(r => {
    const best = r.price === minP && minP != null, worst = r.price === maxP && maxP != null && minP !== maxP;
    return `<tr>
        <td><span class="stag">${esc(r.site)}</span></td>
        <td style="font-size:11px;max-width:180px">${esc(r.productName || '—')}</td>
        <td><span class="pv ${best ? 'best' : worst ? 'worst' : ''}">${r.price != null ? '₹' + r.price.toLocaleString('en-IN') : '—'}</span>${best ? '<span class="bdg">BEST</span>' : ''}</td>
        <td style="font-size:11px">${esc(r.availability || '—')}</td>
        <td style="font-size:10px;font-family:var(--mono);color:var(--ink3)">${esc(r.notes || '')}</td>
        </tr>`;
    }).join('')}
    </tbody>
    </table></div>
</div>` : '';

    const insightHtml = job.insight ? `
<div class="fi3" style="margin-bottom:12px">
    <div class="secl">Recommendation</div>
    <div class="ins"><div class="insl">Scout Analysis</div>${esc(job.insight)}</div>
</div>` : '';

    const actHtml = job.status === 'done' ? `
<div class="fi3 acts">
    <button class="ab p" onclick="exportCSV('${job.id}')">↓ Export CSV</button>
    <button class="ab" onclick="copyRec('${job.id}')">⎘ Copy recommendation</button>
    <button class="ab" onclick="rerun('${job.id}')">↺ Re-run</button>
</div>` : '';

    area.innerHTML = `<div style="display:flex;flex-direction:column">
<div style="display:flex;align-items:baseline;gap:9px;margin-bottom:13px;padding-bottom:11px;border-bottom:1px solid var(--border)">
    <div>
    <div style="font-family:var(--serif);font-size:17px;font-weight:400;font-style:italic">${esc(job.cfg.product)}</div>
    <div style="font-family:var(--mono);font-size:10px;color:var(--ink3);margin-top:2px">${esc(job.cfg.qty)} · ${esc(job.cfg.budget)} · ${job.streams.length} sites</div>
    </div>
    <div style="margin-left:auto;display:flex;align-items:center;gap:5px">
    <span class="dot ${job.status}"></span>
    <span style="font-family:var(--mono);font-size:10px;color:var(--ink3)">${job.status}</span>
    </div>
</div>
<div style="margin-bottom:13px"><div class="secl">Live agent streams</div><div>${streamsHtml}</div></div>
${priceHtml}${insightHtml}${actHtml}
</div>`;
}

// ─── Core agent runner ─────────────────────────────────────────
async function startJob() {
    const tfKey = document.getElementById('tf-key').value.trim();
    if (!tfKey) {
    alert('Enter your TinyFish API key first.');
    return;
    }
    const product = document.getElementById('product').value.trim();
    if (!product) {
    alert('Enter a product to research.');
    return;
    }
    const sites = getSelectedSites();
    if (!sites.length) {
    alert('Select at least one site.');
    return;
    }

    const btn = document.getElementById('run-btn');
    btn.disabled = true; btn.textContent = '⟳ Running…';

    const cfg = {
    product,
    qty: document.getElementById('qty').value.trim(),
    budget: document.getElementById('budget').value.trim(),
    instructions: document.getElementById('instructions').value.trim(),
    sites
    };
    const job = mkJob(cfg);
    activeId = job.id;
    document.getElementById('empty-state')?.remove();
    renderJob(job);
    // enable stop button
    btn.disabled = false; btn.textContent = '⏸ Stop Scout'; btn.onclick = () => stopJob(job.id);

    // Run all sites in parallel
    await Promise.all(sites.map((site, idx) => runSite(job, site, idx, tfKey)));

    // If not already stopped, finish normally
    if (job.status !== 'stopped') {
    job.status = 'done'; job.endTime = Date.now();
    buildInsight(job);
    }
    renderSidebar();
    if (activeId === job.id) renderJob(job);
    btn.disabled = false; btn.textContent = '▶ Run Scout'; btn.onclick = startJob;
}

async function runSite(job, site, idx, tfKey) {
    const s = job.streams[idx];
    s.status = 'running';
    addLog(job.id, idx, 'a', `Launching TinyFish agent → ${site.name}…`);
    updateUI(job, idx);

    const body = {
    url: site.url,
    goal: buildGoal(job.cfg),
    browser_profile: 'stealth',
    proxy_config: { enabled: false }
    };

    try {
    // POST to our proxy which forwards to TinyFish and streams back SSE
    const controller = new AbortController();
    s.controller = controller;
    const resp = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TinyFish-Key': tfKey },
        body: JSON.stringify(body),
        signal: controller.signal
    });

    if (!resp.ok) {
        const err = await resp.text();
        if (resp.status === 404 || resp.status === 405 || err.includes('Cannot POST')) {
        throw new CorsError('Backend proxy not configured or listening. See setup instructions below.');
        }
        throw new Error(`Proxy error ${resp.status}: ${err.slice(0, 100)}`);
    }

    addLog(job.id, idx, 'a', 'Browser agent active, navigating site…');

    // Read SSE stream from proxy
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
            const ev = JSON.parse(raw);
            handleEvent(job, idx, site, ev);
        } catch (e) { }
        }
    }

    if (s.status === 'running') { s.status = 'done'; addLog(job.id, idx, 'd', 'Completed.'); updateUI(job, idx); }

    } catch (err) {
    // If the fetch was aborted by user, mark as stopped and don't push error result
    if (err && (err.name === 'AbortError' || (err.message || '').toLowerCase().includes('aborted'))) {
        s.status = 'stopped';
        addLog(job.id, idx, 'e', 'Stopped by user.');
        updateUI(job, idx);
        if (activeId === job.id) renderJob(job);
        return;
    }

    if (err instanceof CorsError || err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch') || err.message.includes('proxy')) {
        // Proxy not running — fall back to Claude web_search for demo purposes
        addLog(job.id, idx, 'a', 'Proxy not available. Falling back to web search agent…');
        await runViaWebSearch(job, site, idx, tfKey);
    } else {
        s.status = 'error';
        addLog(job.id, idx, 'e', err.message.slice(0, 100));
        job.results.push({ site: site.name, productName: null, price: null, availability: 'Error', notes: err.message.slice(0, 80) });
        updateUI(job, idx);
        if (activeId === job.id) renderJob(job);
    }
    }
}

class CorsError extends Error { }

function handleEvent(job, idx, site, ev) {
    const s = job.streams[idx];
    const type = ev.type || ev.event_type || '';
    if (type === 'STARTED') { addLog(job.id, idx, 'a', 'Browser launched.'); }
    else if (type === 'STREAMING_URL') { addLog(job.id, idx, 'a', 'Live browser session active.'); }
    else if (type === 'PROGRESS') { const m = ev.purpose || ev.message || ''; if (m) addLog(job.id, idx, 'a', m.slice(0, 100)); }
    else if (type === 'THINKING') { const m = ev.message || ev.content || ''; if (m) addLog(job.id, idx, 't', m.slice(0, 100)); }
    else if (type === 'COMPLETE' || type === 'COMPLETED') {
    s.status = 'done';
    const r = ev.resultJson || ev.result_json || ev.result || null;
    if (r) {
        const parsed = parseResult(site.name, r);
        if (parsed) { job.results.push(parsed); addLog(job.id, idx, 'd', `Done → ₹${parsed.price != null ? parsed.price.toLocaleString('en-IN') : 'N/A'}`); }
        else addLog(job.id, idx, 'd', 'Extraction complete (no price found).');
    } else addLog(job.id, idx, 'd', 'Complete. No structured result.');
    updateUI(job, idx);
    if (activeId === job.id) renderJob(job);
    } else if (type === 'ERROR') {
    s.status = 'error';
    addLog(job.id, idx, 'e', (ev.message || ev.error || 'Agent error').slice(0, 100));
    job.results.push({ site: site.name, productName: null, price: null, availability: 'Error', notes: (ev.message || ev.error || '').slice(0, 80) });
    updateUI(job, idx);
    if (activeId === job.id) renderJob(job);
    }
}

function stopJob(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    job.status = 'stopped';
    job.endTime = Date.now();
    // abort all running streams
    job.streams.forEach((s, i) => {
    if (s.controller && typeof s.controller.abort === 'function') {
        try { s.controller.abort(); } catch (e) { }
        s.status = s.status === 'done' ? 'done' : 'stopped';
        addLog(job.id, i, 'e', 'Stopped by user.');
        updateUI(job, i);
    }
    });
    renderSidebar();
    if (activeId === job.id) renderJob(job);
    const btn = document.getElementById('run-btn');
    if (btn) { btn.textContent = '▶ Run Scout'; btn.onclick = startJob; btn.disabled = false; }
}

function parseResult(siteName, r) {
    if (typeof r === 'string') { try { r = JSON.parse(r) } catch (e) { return null } }
    const d = r.data || r.product || r.item || r;
    let price = null;
    const rawP = d.price || d.unit_price || d.current_price || d.amount;
    if (rawP != null) price = parseFloat(String(rawP).replace(/[^0-9.]/g, '')) || null;
    return {
    site: siteName, productName: d.name || d.product_name || d.title || null, price,
    availability: d.availability || (d.in_stock != null ? (d.in_stock ? 'In Stock' : 'Out of Stock') : null) || null,
    notes: [d.bulk_discount, d.shipping].filter(Boolean).join(' · ') || d.notes || null
    };
}

// ─── Fallback: Claude web_search when proxy unavailable ───────
async function runViaWebSearch(job, site, idx, tfKey) {
    const s = job.streams[idx];
    const { product, qty, instructions } = job.cfg;
    addLog(job.id, idx, 'a', `Web search agent searching ${site.name}…`);

    const sys = `You are a procurement pricing research agent. Use web_search to find the current price of the requested product on the specified retailer. Return ONLY valid JSON, no markdown, no extra text:
{"name":"exact product name","price":00.00,"availability":"In Stock/Out of Stock/Unknown","bulk_discount":"description or null","shipping":"free/estimate/unknown","notes":"procurement notes","url":"product URL or null","error":null}
If not found, set error field and price to null.`;

    const msg = `Find the current price of "${product}" on ${site.name} (${site.url}).${qty ? ` Needed: ${qty}.` : ''} ${instructions || ''}
Return only the JSON object.`;

    try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: sys,
        messages: [{ role: 'user', content: msg }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
        })
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Claude API ${resp.status}: ${errText.slice(0, 120)}`);
    }

    const data = await resp.json();
    addLog(job.id, idx, 't', 'Processing search results…');

    // Log any search actions
    data.content?.filter(b => b.type === 'tool_use').forEach(b => {
        addLog(job.id, idx, 'a', `Searching: ${b.input?.query || '…'}`);
    });

    const textBlock = data.content?.filter(b => b.type === 'text').pop();
    if (!textBlock) throw new Error('No response from Claude');

    const clean = textBlock.text.replace(/```json|```/g, '').trim();
    let result;
    try { result = JSON.parse(clean); }
    catch (e) {
        const m = clean.match(/\{[\s\S]*?\}/);
        if (m) result = JSON.parse(m[0]); else throw new Error('Could not parse result');
    }

    s.status = 'done';
    let price = null;
    if (result.price != null) price = parseFloat(String(result.price).replace(/[^0-9.]/g, '')) || null;
    const priceStr = price != null ? ` → ₹${price.toLocaleString('en-IN')}` : '';
    addLog(job.id, idx, 'd', `Done${priceStr}`);
    job.results.push({
        site: site.name, productName: result.name || null, price,
        availability: result.availability || null, notes: [result.bulk_discount, result.shipping].filter(Boolean).join(' · ') || result.notes || null
    });

    } catch (err) {
    s.status = 'error';
    addLog(job.id, idx, 'e', `${err.message.slice(0, 100)}`);
    job.results.push({ site: site.name, productName: null, price: null, availability: 'Error', notes: err.message.slice(0, 80) });
    }
    updateUI(job, idx);
    if (activeId === job.id) renderJob(job);
}

function buildGoal(cfg) {
    let g = `Search for "${cfg.product}" on this website.`;
    if (cfg.qty) g += ` I need ${cfg.qty}.`;
    g += ` Extract: exact product name, current unit price, availability, bulk discount tiers, shipping cost. Return JSON: {"name":"...","price":00.00,"availability":"...","bulk_discount":"...","shipping":"...","notes":"...","url":"..."}`;
    if (cfg.instructions) g += ` Additional requirements: ${cfg.instructions}`;
    return g;
}

function buildInsight(job) {
    const valid = job.results.filter(r => r.price != null);
    if (!valid.length) return;
    const best = valid.reduce((a, b) => a.price < b.price ? a : b);
    const worst = valid.reduce((a, b) => a.price > b.price ? a : b);
    const sav = ((1 - best.price / worst.price) * 100).toFixed(1);
    const mid = valid.filter(r => r.site !== best.site && r.site !== worst.site);
    job.insight = `${best.site} offers the lowest price at ₹${best.price.toLocaleString('en-IN')}, saving ${sav}% vs ₹${worst.price.toLocaleString('en-IN')} from ${worst.site}.`;
    if (mid.length) job.insight += ` Mid-range options: ${mid.map(r => `${r.site} at ₹${r.price.toLocaleString('en-IN')}`).join(', ')}.`;
    job.insight += job.cfg && job.cfg.qty
    ? ` For ${job.cfg.qty}, recommend sourcing from ${best.site}. Verify current availability and shipping costs before ordering.`
    : ` Recommend sourcing from ${best.site}. Verify current availability and shipping costs before ordering.`;
}

// ─── UI helpers ────────────────────────────────────────────────
function addLog(jid, idx, type, msg) {
    const job = jobs.find(j => j.id === jid); if (!job) return;
    const s = job.streams[idx];
    const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    s.logs.push({ time: now, type, msg }); if (s.logs.length > 30) s.logs.shift();
    const el = document.getElementById(`log-${jid}-${idx}`);
    if (el) { el.innerHTML = s.logs.map(l => `<div class="ll"><span class="lt">${l.time}</span><span class="lm ${l.type}">${esc(l.msg)}</span></div>`).join(''); el.scrollTop = el.scrollHeight; }
}

function updateUI(job, idx) {
    const s = job.streams[idx];
    const card = document.getElementById(`sc-${job.id}-${idx}`); if (!card) return;
    const dot = card.querySelector('.dot'); const bar = card.querySelector('.pb2');
    if (dot) dot.className = `dot ${s.status === 'pending' ? 'idle' : s.status}`;
    if (bar) { bar.style.width = { done: 100, running: 55, error: 100, pending: 0 }[s.status] + '%'; if (s.status === 'done') bar.classList.add('done'); }
}

function exportCSV(id) {
    const job = jobs.find(j => j.id === id); if (!job?.results.length) return;
    const rows = [['Source', 'Product', 'Price', 'Availability', 'Notes']];
    job.results.forEach(r => rows.push([r.site, r.productName || '', r.price != null ? r.price.toFixed(2) : '', r.availability || '', r.notes || '']));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `scout-${job.cfg.product.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}.csv`; a.click();
}

function copyRec(id) { const job = jobs.find(j => j.id === id); if (job?.insight) navigator.clipboard.writeText(job.insight).then(() => alert('Copied!')); }
function rerun(id) {
    const job = jobs.find(j => j.id === id); if (!job) return;
    set('product', job.cfg.product); set('qty', job.cfg.qty); set('budget', job.cfg.budget); set('instructions', job.cfg.instructions || '');
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', job.cfg.sites.some(s => s.name === c.textContent.trim())));
}

function esc(s) { 
    if (s == null) return ''; 
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); 
}

function getSelectedSites() { 
    return [...document.querySelectorAll('.chip.on')].map(c => ({ name: c.textContent.trim(), url: c.dataset.url })); 
}
