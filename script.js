const microButton = document.getElementById('micro-button');
const progressBar = document.getElementById('progress-bar');

let silenceTimer;
let personality = {};
let tasks = [];

// Clés / endpoints
const ASSEMBLYAI_KEY = 'TON_ASSEMBLYAI_KEY';
const MISTRAL_ENDPOINT = 'TON_ENDPOINT_MISTRAL';

// Charger JSON locaux
async function loadJSON() {
  const personalityResp = await fetch('personality.json');
  personality = await personalityResp.json();

  const tasksResp = await fetch('tasks.json');
  tasks = await tasksResp.json();

  // Charger tasks depuis localStorage si existant
  const savedTasks = localStorage.getItem('tasks');
  if (savedTasks) tasks = JSON.parse(savedTasks);

  updateProgress();
}

// Met à jour la barre de progression
function updateProgress() {
  const completed = tasks.filter(t => t.done).length;
  const total = tasks.length || 1;
  const percent = (completed / total) * 100;
  progressBar.style.width = percent + "%";
}

// Sauvegarde tasks dans localStorage
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Fonction parler avec ondulation
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.name.includes("Voix 1") && v.lang === "fr-FR");

  microButton.classList.add('ondulating');
  speechSynthesis.speak(utterance);

  utterance.onend = () => {
    microButton.classList.remove('ondulating');
    startListening();
  };
}

// Transcription avec AssemblyAI
async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');

  // Upload audio
  const uploadResp = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { 'Authorization': ASSEMBLYAI_KEY },
    body: formData
  });
  const uploadData = await uploadResp.json();
  const audioUrl = uploadData.upload_url;

  // Créer transcription
  const transcriptionResp = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { 'Authorization': ASSEMBLYAI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl })
  });
  const transcriptionData = await transcriptionResp.json();

  // Polling transcription
  let transcriptText = '';
  const startTime = Date.now();
  while (true) {
    const statusResp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptionData.id}`, {
      headers: { 'Authorization': ASSEMBLYAI_KEY }
    });
    const statusData = await statusResp.json();
    if (statusData.status === 'completed') {
      transcriptText = statusData.text;
      break;
    } else if (statusData.status === 'failed') {
      transcriptText = '';
      break;
    }
    // Timeout 60s
    if (Date.now() - startTime > 60000) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  return transcriptText;
}

// Envoi à Mistral
async function queryMistral(text) {
  const response = await fetch(MISTRAL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: text,
      personality: personality,
      tasks: tasks
    })
  });
  const data = await response.json();

  if (data.tasks) {
    tasks = data.tasks;
    saveTasks();
  }
  return data.response;
}

// Capture audio + transcription + Mistral
async function processAudio(audioBlob) {
  const transcript = await transcribeAudio(audioBlob);
  if (!transcript) return "Je n'ai pas compris, peux-tu répéter ?";
  const responseText = await queryMistral(transcript);
  updateProgress();
  return responseText;
}

// Démarrage de l’écoute
async function startListening() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    console.log("Assistant arrêté pour silence >5min.");
  }, 5*60*1000);

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Microphone non supporté");
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  let chunks = [];

  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(chunks, { type: 'audio/wav' });
    chunks = [];
    const responseText = await processAudio(audioBlob);
    speak(responseText);
  };

  mediaRecorder.start();

  // Arrêt automatique après 5 sec
  setTimeout(() => mediaRecorder.stop(), 5000);
}

// Clic sur micro
microButton.addEventListener('click', startListening);

// Précharger voix + JSON
speechSynthesis.onvoiceschanged = () => {};
loadJSON();

// Enregistrer service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Service Worker enregistré'))
    .catch(err => console.log('Erreur SW', err));
}
