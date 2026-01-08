// Éléments
const microButton = document.getElementById('micro-button');
const progressBar = document.getElementById('progress-bar');

let silenceTimer;
let personality = {};   // Contenu de personality.json
let tasks = [];         // Contenu de tasks.json

// Charger les JSON (simulé ici pour la démo, remplacer par fetch si serveur)
function loadJSON() {
  // Simuler lecture fichiers
  personality = { name: "", tone: "", functions: [] };
  tasks = [
    { title: "", done: false, time: "", notes: "" }
  ];
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

// Simuler transcription + réponse Mistral
async function processAudioDummy() {
  // Ici, tu intégreras MediaRecorder + Whisper + Mistral
  const transcript = "Commande simulée de l'utilisateur";

  // L’IA peut modifier le JSON (simulé)
  if (tasks.length && !tasks[0].done) tasks[0].done = true;
  updateProgress();

  // Réponse simulée Mistral
  return `Tâche "${tasks[0].title || 'Exemple'}" mise à jour.`;
}

// Démarrer l’écoute
async function startListening() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    console.log("Assistant arrêté pour silence >5min.");
  }, 5*60*1000);

  const response = await processAudioDummy();
  speak(response);
}

// Clic sur le micro
microButton.addEventListener('click', startListening);

// Initialisation
speechSynthesis.onvoiceschanged = () => {};
loadJSON();
