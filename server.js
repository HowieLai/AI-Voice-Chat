require('dotenv').config();
const express = require('express');
const multer = require('multer');

const app = express();
const upload = multer();

app.use(express.static('.'));

app.post('/api/stt', upload.single('file'), async (req, res) => {
  try {
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('STT API error:', errText);
      return res.status(500).json({ error: 'Transcription failed' });
    }

    const data = await response.json();
    res.json({ text: data.text });
  } catch (err) {
    console.error('STT error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: req.body.text }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Chat API error:', errText);
      return res.status(500).json({ error: 'Chat request failed' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
