const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('.'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-TinyFish-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/api/tinyfish', async (req, res) => {
  const tfKey = req.headers['x-tinyfish-key'];
  if (!tfKey) return res.status(401).json({ error: 'Missing TinyFish API key' });

  try {
    const tfResp = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': tfKey
      },
      body: JSON.stringify(req.body)
    });

    if (!tfResp.ok) {
      const errText = await tfResp.text();
      return res.status(tfResp.status).send(errText);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    tfResp.body.pipe(res);
  } catch (err) {
    console.error('Proxy error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// Explicitly serve the agent HTML on the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'scout-procurement-agent.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scout proxy running at http://localhost:${PORT}`));
