const microButton = document.getElementById('micro-button');
const progressBar = document.getElementById('progress-bar');

let silenceTimer;
let personality = {};
let tasks = [];

// Clés / endpoints
const ASSEMBLYAI_KEY = '2d3dff825169489abaa1eb25d3e01f5c';
const MISTRAL_ENDPOINT = 'PD85t8aUMKTkZGDlAWhOWyxywwYRkSq1';

// Charger JSON locaux
async function loadJSON() {
  const personalityResp = await fetch('personality.json');
  personality = await personalityResp.json();

  const tasksResp = await fetch('tasks.json');
  tasks = await tasksResp.json();

  updateProgress();
}

// Met à jour la barre de progression
function updateProgress() {
  const completed = tasks.filter(t => t.done).length;
  const total = tasks.length || 1;
  const percent = (completed / total) * 100;
  progressBar.style.width = percent + "%";
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
  formData.append('audio', audioBlob);

  const response = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { 'Authorization': ASSEMBLYAI_KEY },
    body: audioBlob
  });

  const data = await response.json();
  const audioUrl = data.upload_url;

  // Créer transcription
  const transcriptionResp = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { 'Authorization': ASSEMBLYAI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl })
  });
  const transcriptionData = await transcriptionResp.json();

  // Polling pour transcription terminée
  let transcriptText = '';
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

  // Mise à jour tasks si Mistral renvoie modifications
  if (data.tasks) {
    tasks = data.tasks;
    await fetch('tasks.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks, null, 2)
    });
  }
  return data.response;
}

// Capture audio + transcription + Mistral
async function processAudio(audioBlob) {
  const transcript = await transcribeAudio(audioBlob);
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

  // Arrêt automatique après 5 sec pour exemple
  setTimeout(() => mediaRecorder.stop(), 5000);
}

// Clic sur micro
microButton.addEventListener('click', startListening);

// Initialisation
speechSynthesis.onvoiceschanged = () => {};
loadJSON();
