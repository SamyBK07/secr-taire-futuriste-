import express from 'express';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/api/process', upload.single('audio'), async (req, res) => {
  try {
    console.log('MIME:', req.file.mimetype);
    console.log('SIZE:', req.file.size);

    /* ---------- WHISPER ---------- */
    const formData = new FormData();
    formData.append(
      'file',
      fs.createReadStream(req.file.path),
      'audio.mp4' // 👈 filename CRUCIAL
    );
    formData.append('model', 'whisper-1');

    const whisperRes = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: formData
      }
    );

    const whisper = await whisperRes.json();

    if (!whisper.text) {
      throw new Error('Whisper transcription failed');
    }

    /* ---------- MISTRAL ---------- */
    const personality = JSON.parse(
      fs.readFileSync('./public/personality.json', 'utf8')
    );

    const mistralRes = await fetch(
      'https://api.mistral.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
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
    );

    const mistral = await mistralRes.json();

    fs.unlinkSync(req.file.path);

    res.json({
      reply: mistral.choices[0].message.content
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'processing_failed' });
  }
});

app.listen(3000, () => {
  console.log('🚀 http://localhost:3000');
});
