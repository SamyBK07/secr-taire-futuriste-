import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/api/process', upload.single('audio'), async (req, res) => {
  try {
    // 🎙️ Whisper
    const fd = new FormData();
    fd.append('file', fs.createReadStream(req.file.path));
    fd.append('model', 'whisper-1');

    const whisper = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: fd
      }
    ).then(r => r.json());

    // 🧠 Mistral
    const personality = JSON.parse(
      fs.readFileSync('./public/personality.json', 'utf8')
    );

    const mistral = await fetch(
      'https://api.mistral.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistral-small',
          messages: [
            personality,
            { role: 'user', content: whisper.text }
          ]
        })
      }
    ).then(r => r.json());

    fs.unlinkSync(req.file.path);

    res.json({ reply: mistral.choices[0].message.content });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'processing_failed' });
  }
});

app.listen(3000, () =>
  console.log('🚀 Secrétaire futuriste sur http://localhost:3000')
);
