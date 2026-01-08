const microButton = document.getElementById("micro-button");
const progressBar = document.getElementById("progress-bar");

let personality = {};
let tasks = [];

let mediaRecorder = null;
let stream = null;
let chunks = [];

// 🔑 CLÉS
const ASSEMBLYAI_KEY = "2d3dff825169489abaa1eb25d3e01f5c";
const MISTRAL_ENDPOINT = "PD85t8aUMKTkZGDlAWhOWyxywwYRkSq1";

// 📥 Chargement données
async function loadData() {
  personality = await fetch("personality.json").then(r => r.json());
  tasks = await fetch("tasks.json").then(r => r.json());

  const savedTasks = localStorage.getItem("tasks");
  if (savedTasks) tasks = JSON.parse(savedTasks);

  updateProgress();
}

// 📊 Progression tâches
function updateProgress() {
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length || 1;
  progressBar.style.width = `${(done / total) * 100}%`;
}

// 🔊 Parler (voix Apple)
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.lang === "fr-FR") || voices[0];

  microButton.classList.add("ondulating");
  speechSynthesis.speak(utterance);

  utterance.onend = () => {
    microButton.classList.remove("ondulating");
  };
}

// 🎤 ENREGISTREMENT 10 SECONDES
async function startListening() {
  if (mediaRecorder?.state === "recording") return;

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

  chunks = [];

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());

    const audioBlob = new Blob(chunks, { type: "audio/webm" });
    if (audioBlob.size < 1000) {
      speak("Je n'ai rien entendu.");
      return;
    }

    const text = await processAudio(audioBlob);
    speak(text);
  };

  mediaRecorder.start();
  microButton.classList.add("recording");

  setTimeout(() => {
    if (mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      microButton.classList.remove("recording");
    }
  }, 10000);
}

// 🧠 Transcription AssemblyAI
async function transcribeAudio(blob) {
  const upload = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: { Authorization: ASSEMBLYAI_KEY },
    body: blob
  }).then(r => r.json());

  const transcript = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: ASSEMBLYAI_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ audio_url: upload.upload_url })
  }).then(r => r.json());

  while (true) {
    const status = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcript.id}`,
      { headers: { Authorization: ASSEMBLYAI_KEY } }
    ).then(r => r.json());

    if (status.status === "completed") return status.text;
    if (status.status === "failed") return "";

    await new Promise(r => setTimeout(r, 1000));
  }
}

// 🤖 Mistral
async function queryMistral(text) {
  const res = await fetch(MISTRAL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: text,
      personality,
      tasks
    })
  }).then(r => r.json());

  if (res.tasks) {
    tasks = res.tasks;
    localStorage.setItem("tasks", JSON.stringify(tasks));
    updateProgress();
  }

  return res.response || "D'accord.";
}

// 🔁 Pipeline complet
async function processAudio(blob) {
  const transcript = await transcribeAudio(blob);
  if (!transcript) return "Je n'ai pas compris.";
  return await queryMistral(transcript);
}

// 🎯 Interaction
microButton.addEventListener("click", startListening);

// 🚀 Init
loadData();

// 🔌 Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}
