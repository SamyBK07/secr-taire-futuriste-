async function startListening() {
  try {
    log("🎤 Start listening");

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];

    mediaRecorder.ondataavailable = e => chunks.push(e.data);

    mediaRecorder.onstop = async () => {
      try {
        stream.getTracks().forEach(t => t.stop());

        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        log(`📦 Audio blob: ${blob.size} bytes (${blob.type})`);

        const form = new FormData();
        form.append("audio", blob, "audio.webm");

        log("🚀 Envoi vers /api/transcribe");
        const transcriptRes = await fetch("/api/transcribe", {
          method: "POST",
          body: form
        });

        if (!transcriptRes.ok) {
          throw "Erreur transcription HTTP " + transcriptRes.status;
        }

        const transcript = await transcriptRes.json();
        log("📝 Transcription: " + transcript.text);

        if (!transcript.text || transcript.text.trim() === "") {
          speak("Je n’ai rien compris.");
          return;
        }

        log("🤖 Envoi vers Mistral");
        const replyRes = await fetch("/api/mistral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: transcript.text,
            personality,
            tasks
          })
        });

        if (!replyRes.ok) {
          throw "Erreur Mistral HTTP " + replyRes.status;
        }

        const reply = await replyRes.json();
        log("✅ Réponse Mistral reçue");

        speak(reply.response);

      } catch (err) {
        logError(err);
        speak("Une erreur est survenue.");
      }
    };

    mediaRecorder.start();
    microButton.classList.add("recording");

    setTimeout(() => {
      log("⏹ Stop recording");
      mediaRecorder.stop();
      microButton.classList.remove("recording");
    }, 10000);

  } catch (err) {
    logError(err);
  }
}
