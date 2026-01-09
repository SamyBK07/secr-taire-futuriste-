const microButton = document.getElementById("micro-button");
const progressBar = document.getElementById("progress-bar");

let personality = {};
let tasks = [];

let mediaRecorder;
let stream;
let chunks = [];

async function loadData() {
  console.log("📂 Chargement personality & tasks");
  personality = await fetch("/personality.json").then(r => r.json());
  tasks = await fetch("/tasks.json").then(r => r.json());
  updateProgress();
}

function updateProgress() {
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length || 1;
  progressBar.style.width = `${(done / total) * 100}%`;
}

function speak(text) {
  console.log("🔊 Speak :", text);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = speechSynthesis.getVoices().find(v => v.lang === "fr-FR");
  microButton.classList.add("ondulating");
  speechSynthesis.speak(utterance);
  utterance.onend = () => microButton.classList.remove("ondulating");
}

async function startListening() {
  console.log("🎤 Start listening");

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  chunks = [];

  mediaRecorder.ondataavailable = e => chunks.push(e.data);

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());

    const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
    console.log("📦 Audio blob :", blob.size, blob.type);

    const form = new FormData();
    form.append("audio", blob, "audio.webm");

    console.log("🚀 Envoi vers /api/transcribe");
    const transcriptRes = await fetch("/api/transcribe", {
      method: "POST",
      body: form
    });

    const transcript = await transcriptRes.json();
    console.log("📝 Transcription reçue :", transcript.text);

    if (!transcript.text || transcript.text.trim() === "") {
      speak("Je n’ai rien compris.");
      return;
    }

    console.log("🤖 Envoi vers Mistral");
    const replyRes = await fetch("/api/mistral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: transcript.text,
        personality,
        tasks
      })
    });

    const reply = await replyRes.json();
    console.log("✅ Réponse Mistral :", reply.response);

    speak(reply.response);
  };

  mediaRecorder.start();
  microButton.classList.add("recording");

  setTimeout(() => {
    console.log("⏹ Stop recording");
    mediaRecorder.stop();
    microButton.classList.remove("recording");
  }, 10000);
}

microButton.addEventListener("click", startListening);
loadData();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}
