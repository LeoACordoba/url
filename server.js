require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const dns = require('dns');
const mongoose = require('mongoose');
const cors = require('cors');
const { URL } = require('url');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public')); // serve frontend

// MONGODB: put MONGO_URI in .env
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/urlshortener';
mongoose.set('strictQuery', true);
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true }
});
const Url = mongoose.model('Url', urlSchema);

// Helper: create a unique numeric short code
async function generateUniqueShort() {
  // Try random numbers until unique — simple and effective for small scale
  while (true) {
    const candidate = Math.floor(Math.random() * 900000) + 100000; // 6-digit
    const exists = await Url.findOne({ short_url: candidate }).exec();
    if (!exists) return candidate;
  }
}

// POST endpoint to create short URL
app.post('/api/shorturl', async (req, res) => {
  const input = req.body.url;
  if (!input) return res.json({ error: 'invalid url' });

  // Parse hostname using WHATWG URL
  let hostname;
  try {
    const parsed = new URL(input);
    hostname = parsed.hostname;
  } catch (err) {
    // If parsing fails (no protocol), try adding http:// and parse again
    try {
      const parsed = new URL('http://' + input);
      hostname = parsed.hostname;
    } catch (err2) {
      return res.json({ error: 'invalid url' });
    }
  }

  // Use dns.lookup to verify hostname resolves
  dns.lookup(hostname, async (dnsErr) => {
    if (dnsErr) {
      return res.json({ error: 'invalid url' });
    } else {
      try {
        // If URL already exists in DB, return existing doc
        const existing = await Url.findOne({ original_url: input }).exec();
        if (existing) {
          return res.json({
            original_url: existing.original_url,
            short_url: existing.short_url
          });
        }
        // Otherwise create new
        const short = await generateUniqueShort();
        const newUrl = new Url({ original_url: input, short_url: short });
        await newUrl.save();
        return res.json({ original_url: newUrl.original_url, short_url: newUrl.short_url });
      } catch (saveErr) {
        console.error(saveErr);
        return res.status(500).json({ error: 'server error' });
      }
    }
  });
});

// GET endpoint to redirect
app.get('/api/shorturl/:short', async (req, res) => {
  const short = Number(req.params.short);
  if (Number.isNaN(short)) return res.json({ error: 'No short URL found for the given input' });

  try {
    const doc = await Url.findOne({ short_url: short }).exec();
    if (doc) return res.redirect(doc.original_url);
    return res.json({ error: 'No short URL found for the given input' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Simple index
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
