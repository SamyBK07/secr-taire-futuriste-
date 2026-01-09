const microButton = document.getElementById("micro-button");
const progressBar = document.getElementById("progress-bar");

let personality = {};
let tasks = [];

let mediaRecorder;
let stream;
let chunks = [];

async function loadData() {
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
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = speechSynthesis.getVoices().find(v => v.lang === "fr-FR");
  microButton.classList.add("ondulating");
  speechSynthesis.speak(utterance);
  utterance.onend = () => microButton.classList.remove("ondulating");
}

async function startListening() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  chunks = [];

  mediaRecorder.ondataavailable = e => chunks.push(e.data);

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: "audio/webm" });

    const form = new FormData();
    form.append("audio", blob);

    const transcript = await fetch("/api/transcribe", {
      method: "POST",
      body: form
    }).then(r => r.json());

    const reply = await fetch("/api/mistral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: transcript.text,
        personality,
        tasks
      })
    }).then(r => r.json());

    speak(reply.response);
  };

  mediaRecorder.start();
  microButton.classList.add("recording");

  setTimeout(() => {
    mediaRecorder.stop();
    microButton.classList.remove("recording");
  }, 10000);
}

microButton.addEventListener("click", startListening);
loadData();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}
