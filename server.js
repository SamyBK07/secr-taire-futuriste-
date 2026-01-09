import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

app.use((req, _res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

// 🎧 TRANSCRIPTION WHISPER
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    console.log("🎧 Audio reçu");

    const audioFile = fs.createReadStream(req.file.path);

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: (() => {
        const form = new FormData();
        form.append("file", audioFile);
        form.append("model", "whisper-1");
        form.append("language", "fr");
        return form;
      })()
    });

    const data = await whisperRes.json();
    fs.unlinkSync(req.file.path);

    console.log("📝 Transcription :", data.text);
    res.json({ text: data.text });

  } catch (err) {
    console.error("❌ Whisper error", err);
    res.status(500).json({ error: "Whisper failed" });
  }
});

// 🤖 MISTRAL
app.post("/api/mistral", async (req, res) => {
  try {
    const { prompt, personality, tasks } = req.body;

    console.log("📨 Prompt Mistral :", prompt);

    const mistralRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          {
            role: "system",
            content: `
Nom: ${personality?.name || ""}
Ton: ${personality?.tone || ""}
Fonctions: ${(personality?.functions || []).join(", ")}
Tâches: ${JSON.stringify(tasks || [])}
`
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await mistralRes.json();
    res.json({ response: data.choices[0].message.content });

  } catch (err) {
    console.error("❌ Mistral error", err);
    res.status(500).json({ error: "Mistral failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur actif sur http://localhost:${PORT}`);
});
