const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const { URL } = require('url');

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

// In-memory store
let urls = [];

// Home
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// POST /api/shorturl
app.post('/api/shorturl', (req, res) => {
  const inputUrl = req.body.url;

  // Validate URL format
  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch (err) {
    return res.json({ error: 'invalid url' });
  }

  // Must begin with http:// or https://
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.json({ error: 'invalid url' });
  }

  // DNS lookup to verify hostname exists
  dns.lookup(parsed.hostname, (err) => {
    if (err) return res.json({ error: 'invalid url' });

    // If already exists, return same short_url
    const found = urls.find(u => u.original_url === inputUrl);
    if (found) return res.json(found);

    // Otherwise add a new entry
    const short_url = urls.length + 1;
    const newEntry = { original_url: inputUrl, short_url };
    urls.push(newEntry);
    res.json(newEntry);
  });
});

// GET /api/shorturl/:short_url
app.get('/api/shorturl/:short_url', (req, res) => {
  const short = Number(req.params.short_url);
  const found = urls.find(u => u.short_url === short);

  if (!found) return res.json({ error: 'No short URL found for the given input' });

  res.redirect(found.original_url);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
