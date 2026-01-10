const btn = document.getElementById('talkBtn');
const statusEl = document.getElementById('status');

let voice = null;

/* --------- VOIX IPHONE --------- */
speechSynthesis.onvoiceschanged = () => {
  const voices = speechSynthesis.getVoices();
  voice =
    voices.find(v => v.lang === 'fr-FR' && v.localService)
    || voices.find(v => v.lang === 'fr-FR');
};

function speak(text) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

function setStatus(text, error = false) {
  statusEl.textContent = text;
  statusEl.style.color = error ? '#ff4d4d' : '#00ffe1';
}

/* --------- ENREGISTREMENT --------- */
async function recordAudio(seconds = 10) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];

  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.start();

  await new Promise(r => setTimeout(r, seconds * 1000));
  recorder.stop();

  await new Promise(r => recorder.onstop = r);
  stream.getTracks().forEach(t => t.stop());

  return new Blob(chunks, { type: 'audio/wav' });
}

/* --------- FLOW COMPLET --------- */
btn.onclick = async () => {
  try {
    speak("Je t'écoute.");
    setStatus("🎙️ Enregistrement");

    const audio = await recordAudio(10);

    setStatus("📝 Transcription");

    const form = new FormData();
    form.append('audio', audio);

    const res = await fetch('/api/process', {
      method: 'POST',
      body: form
    });

    if (!res.ok) throw new Error();

    setStatus("🧠 Réponse");

    const { reply } = await res.json();
    speak(reply);

    setStatus("✅ Terminé");

  } catch (e) {
    console.error(e);
    setStatus("❌ Erreur", true);
    speak("Une erreur est survenue.");
  }
};
