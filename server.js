require('dotenv').config();
const express = require('express');
const multer = require('multer');

const app = express();
const upload = multer();

app.use(express.static('.'));
app.use(express.json());

const API_KEYS = [
  'AIzaSyCDNk90awwq7JUfEAJjyp-rETP-Qjt0uIg',
  'AIzaSyAUIt-b_3N1I55D9cTotN3Cw5Ejd42jDmY'
];

async function callGemini(body) {
  const keys = process.env.GOOGLE_API_KEY ? [process.env.GOOGLE_API_KEY] : API_KEYS;
  for (const key of keys) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    if (response.ok) {
      return response.json();
    }
  }
  throw new Error('Gemini request failed');
}

app.post('/api/chat', upload.single('file'), async (req, res) => {
  try {
    let contents;
    if (req.file) {
      const data = req.file.buffer.toString('base64');
      contents = [
        {
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: req.file.mimetype,
                data
              }
            }
          ]
        }
      ];
    } else if (req.body.text) {
      contents = [
        {
          role: 'user',
          parts: [{ text: req.body.text }]
        }
      ];
    } else {
      return res.status(400).json({ error: 'No input provided' });
    }

    const data = await callGemini({ contents });
    const candidate = data.candidates?.[0] || {};
    const reply = candidate.content?.parts?.map(p => p.text || '').join('') || '';
    const thinking = candidate.thinking?.parts?.map(p => p.text || '').join('') || '';
    res.json({ reply, thinking });
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: 'Gemini request failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
