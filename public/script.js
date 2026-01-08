const microButton = document.getElementById("micro-button");
const progressBar = document.getElementById("progress-bar");

let personality = {};
let tasks = [];

let mediaRecorder = null;
let stream = null;
let chunks = [];

// 🔑 AssemblyAI (clé publique autorisée)
const ASSEMBLYAI_KEY = "TA_CLE_ASSEMBLYAI";

// ==============================
// INIT
// ==============================
async function loadData() {
  console.log("📥 Chargement personality & tasks");

  personality = await fetch("/personality.json").then(r => r.json());
  tasks = await fetch("/tasks.json").then(r => r.json());

  personality ||= {};
  tasks = Array.isArray(tasks) ? tasks : [];

  const savedTasks = localStorage.getItem("tasks");
  if (savedTasks) tasks = JSON.parse(savedTasks);

  updateProgress();
}

// ==============================
// UI
// ==============================
function updateProgress() {
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length || 1;
  progressBar.style.width = `${(done / total) * 100}%`;
}

// ==============================
// TTS — Voix Apple
// ==============================
function speak(text) {
  console.log("🔊 Speak :", text);

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.lang === "fr-FR") || voices[0];

  microButton.classList.add("ondulating");
  speechSynthesis.speak(utterance);

  utterance.onend = () => {
    microButton.classList.remove("ondulating");
  };
}

// ==============================
// 🎤 RECORDING — 10 SECONDS
// ==============================
async function startListening() {
  if (mediaRecorder?.state === "recording") return;

  console.log("🎤 Start recording");

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  chunks = [];

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    console.log("⏹️ Recording stopped");

    stream.getTracks().forEach(t => t.stop());

    const audioBlob = new Blob(chunks, { type: "audio/webm" });
    console.log("📦 Audio size :", audioBlob.size);

    if (audioBlob.size < 1000) {
      speak("Je n'ai rien entendu.");
      return;
    }

    const reply = await processAudio(audioBlob);
    speak(reply);
  };

  mediaRecorder.start();
  microButton.classList.add("recording");

  setTimeout(() => {
    if (mediaRecorder.state === "recording") {
      console.log("⏱️ Auto stop (10s)");
      mediaRecorder.stop();
      microButton.classList.remove("recording");
    }
  }, 10000);
}

// ==============================
// 🧠 PIPELINE
// ==============================
async function processAudio(blob) {
  console.log("➡️ Processing audio");

  const transcript = await transcribeAudio(blob);

  if (!transcript) {
    console.warn("⚠️ Empty transcript");
    return "Je n'ai pas compris.";
  }

  console.log("📝 Transcript :", transcript);

  const response = await queryMistral(transcript);
  return response;
}

// ==============================
// ☁️ AssemblyAI
// ==============================
async function transcribeAudio(blob) {
  console.log("☁️ Uploading audio to AssemblyAI");

  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      Authorization: ASSEMBLYAI_KEY
    },
    body: blob
  });

  const upload = await uploadRes.json();
  console.log("✅ Upload URL :", upload.upload_url);

  const transcriptRes = await fetch(
    "https://api.assemblyai.com/v2/transcript",
    {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        audio_url: upload.upload_url,
        language_code: "fr"
      })
    }
  );

  const transcript = await transcriptRes.json();

  while (true) {
    const statusRes = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcript.id}`,
      {
        headers: { Authorization: ASSEMBLYAI_KEY }
      }
    );

    const status = await statusRes.json();
    console.log("⏳ Transcription status :", status.status);

    if (status.status === "completed") return status.text;
    if (status.status === "failed") return "";

    await new Promise(r => setTimeout(r, 1000));
  }
}

// ==============================
// 🤖 MISTRAL (via backend)
// ==============================
async function queryMistral(text) {
  console.log("➡️ Sending to backend /api/mistral");

  const res = await fetch("/api/mistral", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: text,
      personality,
      tasks
    })
  });

  const data = await res.json();
  console.log("⬅️ Mistral response :", data.response);

  if (data.tasks) {
    tasks = data.tasks;
    localStorage.setItem("tasks", JSON.stringify(tasks));
    updateProgress();
  }

  return data.response || "D'accord.";
}

// ==============================
// EVENTS
// ==============================
microButton.addEventListener("click", startListening);

// ==============================
// BOOT
// ==============================
loadData();

// ==============================
// SERVICE WORKER
// ==============================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}
