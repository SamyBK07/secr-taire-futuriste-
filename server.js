import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

/**
 * Proxy vers MISTRAL
 */
app.post("/api/mistral", async (req, res) => {
  try {
    const { prompt, personality, tasks } = req.body;

    console.log("📨 Prompt reçu :", prompt);

    const mistralResponse = await fetch(
      "https://api.mistral.ai/v1/chat/completions",
      {
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
      }
    );

    const data = await mistralResponse.json();

    console.log("🤖 Réponse Mistral reçue");

    res.json({
      response: data.choices?.[0]?.message?.content || ""
    });

  } catch (err) {
    console.error("❌ Erreur Mistral :", err);
    res.status(500).json({ error: "Erreur Mistral" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
