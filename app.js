"use strict";

const $ = (sel) => document.querySelector(sel);

const screens = {
  langs: $("#screen-langs"),
  phrases: $("#screen-phrases"),
  ask: $("#screen-ask"),
};

const state = { lang: null, phrase: null };

// ---------- Speech synthesis ----------

let voices = [];
function loadVoices() {
  voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
}
if (window.speechSynthesis) {
  loadVoices();
  speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

function pickVoice(tag) {
  const lower = tag.toLowerCase();
  const base = lower.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase().replace("_", "-") === lower) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base))
  );
}

function speak(text, tag, onEnd) {
  if (!window.speechSynthesis || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = tag;
  const voice = pickVoice(tag);
  if (voice) u.voice = voice;
  u.rate = 0.9;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  speechSynthesis.speak(u);
}

function speakPhrase() {
  const btn = $("#replay");
  btn.classList.add("speaking");
  speak(state.phrase.t[state.lang.id], state.lang.tts, () => btn.classList.remove("speaking"));
}

// ---------- Rendering ----------

function tile(emoji, label, ariaLabel, onClick) {
  const b = document.createElement("button");
  b.className = "tile";
  b.setAttribute("aria-label", ariaLabel);
  b.title = ariaLabel;
  const e = document.createElement("span");
  e.className = "e";
  e.textContent = emoji;
  b.appendChild(e);
  if (label) {
    const l = document.createElement("span");
    l.className = "label";
    l.textContent = label;
    b.appendChild(l);
  }
  b.addEventListener("click", onClick);
  return b;
}

function renderLangs() {
  screens.langs.replaceChildren(
    ...LANGUAGES.map((lang) =>
      tile(lang.flag, lang.name, lang.name, () => {
        location.hash = lang.id;
      })
    )
  );
}

function renderPhrases() {
  screens.phrases.replaceChildren(
    ...PHRASES.map((p) =>
      tile(p.emoji, null, p.t.en, () => {
        state.phrase = p;
        // Speak inside the tap handler so mobile browsers allow audio.
        speak(p.t[state.lang.id], state.lang.tts);
        location.hash = `${state.lang.id}/${p.id}`;
      })
    )
  );
}

function renderAsk() {
  const p = state.phrase;
  const replay = $("#replay");
  replay.textContent = p.emoji;
  const own = p.t[state.lang.id];
  $("#question-text").textContent = state.lang.id === "en" ? own : `${own} — ${p.t.en}`;
  $("#question-text").dir = "auto";

  $("#answers").replaceChildren(
    ...p.answers.map((a) => tile(a.e, null, a.en, () => showAnswer(a.e, a.en)))
  );

  $("#transcript").hidden = true;
  playback.hidden = true;
  stopListening();
}

function show(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  $("#back").hidden = name === "langs";
  $("#home").hidden = name !== "ask";
  $("#current").textContent = state.lang ? state.lang.flag : "🌍";
  window.scrollTo(0, 0);
}

function route() {
  const [langId, phraseId] = location.hash.slice(1).split("/");
  const lang = LANGUAGES.find((l) => l.id === langId);
  const phrase = PHRASES.find((p) => p.id === phraseId);
  state.lang = lang || null;
  hideAnswer();

  if (!lang) {
    show("langs");
  } else if (!phrase) {
    renderPhrases();
    show("phrases");
  } else {
    state.phrase = phrase;
    renderAsk();
    show("ask");
  }
}

// ---------- Child's answer ----------

const overlay = $("#answer-overlay");

function showAnswer(emoji, english) {
  overlay.querySelector(".overlay-emoji").textContent = emoji;
  overlay.querySelector(".overlay-text").textContent = english;
  overlay.hidden = false;
  speak(english, "en-GB");
}

function hideAnswer() {
  overlay.hidden = true;
}

overlay.addEventListener("click", hideAnswer);

// ---------- Recording + translation ----------
//
// Primary path: Chrome's speech recognition (transcribes the child's language,
// then we translate it to English).
// Fallback path: if recognition is missing or fails, record raw audio with
// MediaRecorder so staff can at least play the message back.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let mediaRecorder = null;
let finalText = "";
let latestText = "";

const micBtn = $("#mic");
const playback = $("#playback");

// Errors where plain audio recording is still worth trying.
const FALLBACK_ERRORS = ["service-not-allowed", "language-not-supported", "network", "bad-grammar"];

const RECOGNITION_ERRORS = {
  "not-allowed": "🚫🎤 Microphone blocked. Tap the icon left of the address bar → Permissions → Microphone → Allow.",
  "audio-capture": "🚫🎤 No microphone found, or another app is using it. Close other apps using the mic and try again.",
  "no-speech": "🔇 No speech heard. Tap 🎤 and speak closer to the microphone. On a computer, check Chrome is using the right mic: chrome://settings/content/microphone",
  network: "📶 Speech recognition needs internet.",
  "service-not-allowed": "Speech recognition is turned off on this device.",
  "language-not-supported": "This language can't be transcribed on this device.",
};

function setMicState(recording) {
  micBtn.classList.toggle("recording", recording);
  micBtn.textContent = recording ? "⏹️" : "🎤";
}

function stopListening() {
  if (recognizer) {
    recognizer.onend = null;
    recognizer.onerror = null;
    recognizer.abort();
    recognizer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  setMicState(false);
}

// Ask for microphone permission explicitly. Speech recognition on Android
// doesn't always show the permission prompt itself, and fails silently
// when permission was never granted.
async function ensureMicPermission() {
  if (location.protocol === "file:") {
    throw new Error("🔒 The microphone doesn't work when index.html is opened as a file. Open the https:// link (or run `npx http-server .` and use http://localhost:8080).");
  }
  if (!window.isSecureContext) {
    throw new Error("🔒 The microphone only works over https://. Open the app from its https:// link.");
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("🚫🎤 This browser can't use the microphone. Use Google Chrome.");
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError") throw new Error(RECOGNITION_ERRORS["not-allowed"]);
    throw new Error(RECOGNITION_ERRORS["audio-capture"]);
  }
  return stream;
}

function releaseStream(stream) {
  stream.getTracks().forEach((t) => t.stop());
}

async function startListening() {
  if (window.speechSynthesis) speechSynthesis.cancel();
  playback.hidden = true;
  setMicState(true);
  showTranscript("⏳🎤", "");

  let stream;
  try {
    stream = await ensureMicPermission();
  } catch (err) {
    setMicState(false);
    showTranscript("❌", err.message);
    return;
  }

  if (!Recognition) {
    startAudioRecording(stream, "Speech recognition isn't available in this browser, so the message is recorded instead.");
    return;
  }

  // Android can only give the microphone to one user at a time, so free it
  // (and let text-to-speech release audio focus) before recognition starts.
  releaseStream(stream);
  await new Promise((r) => setTimeout(r, 300));
  if (!micBtn.classList.contains("recording")) return; // cancelled meanwhile

  startRecognition();
}

function startRecognition() {
  finalText = "";
  latestText = "";
  let failed = null;
  const rec = new Recognition();
  recognizer = rec;
  rec.lang = state.lang.tts;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onaudiostart = () => showTranscript("👂…", "");
  rec.onspeechstart = () => {
    if (!latestText) $("#heard").textContent = "🗣️…";
  };

  rec.onresult = (event) => {
    let interim = "";
    finalText = "";
    for (const result of event.results) {
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    latestText = finalText + interim;
    $("#heard").textContent = latestText || "👂…";
  };

  rec.onerror = (event) => {
    failed = event.error;
  };

  rec.onend = () => {
    if (recognizer !== rec) return;
    recognizer = null;
    const heard = latestText.trim();
    if (heard) {
      setMicState(false);
      translateAndShow(heard);
    } else if (failed && FALLBACK_ERRORS.includes(failed)) {
      // Recognition can't work here: record plain audio instead.
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => startAudioRecording(s, `${RECOGNITION_ERRORS[failed] || failed} Recording audio instead.`))
        .catch(() => {
          setMicState(false);
          showTranscript("❌", RECOGNITION_ERRORS["audio-capture"]);
        });
    } else {
      setMicState(false);
      const msg = failed ? RECOGNITION_ERRORS[failed] || `Error: ${failed}` : RECOGNITION_ERRORS["no-speech"];
      if (failed !== "aborted") showTranscript("❌", msg);
    }
  };

  try {
    rec.start();
  } catch (err) {
    recognizer = null;
    setMicState(false);
    showTranscript("❌", `Error: ${err.message}`);
  }
}

// Fallback: record the message so staff can listen to it (no translation).
function startAudioRecording(stream, note) {
  if (!window.MediaRecorder) {
    releaseStream(stream);
    setMicState(false);
    showTranscript("❌", "This browser can't record audio.");
    return;
  }
  const chunks = [];
  const mr = new MediaRecorder(stream);
  mediaRecorder = mr;
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.onstop = () => {
    releaseStream(stream);
    mediaRecorder = null;
    setMicState(false);
    if (!chunks.length) return;
    if (playback.src) URL.revokeObjectURL(playback.src);
    playback.src = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType }));
    playback.hidden = false;
    showTranscript("🎧 ▶️", note);
  };
  mr.start();
  showTranscript("🔴 …", `${note} Tap ⏹️ when finished.`);
}

function showTranscript(heard, english) {
  $("#transcript").hidden = false;
  $("#heard").textContent = heard;
  $("#heard").dir = "auto";
  $("#english").textContent = english;
}

async function translateToEnglish(text, from) {
  if (from === "en") return text;
  try {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&tl=en" +
      `&sl=${encodeURIComponent(from)}&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const out = data[0].map((chunk) => chunk[0]).join("");
    if (out) return out;
  } catch (_) {
    // fall through to the backup service
  }
  const url =
    "https://api.mymemory.translated.net/get" +
    `?langpair=${encodeURIComponent(from)}|en&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return data.responseData.translatedText;
}

async function translateAndShow(heard) {
  showTranscript(heard, "⏳");
  try {
    const english = await translateToEnglish(heard, state.lang.tr);
    $("#english").textContent = english;
    speak(english, "en-GB");
  } catch (_) {
    $("#english").textContent = "❌📶 Translation failed (no internet?)";
  }
}

micBtn.addEventListener("click", () => {
  if (recognizer) {
    recognizer.stop(); // onend will translate what was heard so far
  } else if (mediaRecorder) {
    mediaRecorder.stop(); // onstop will show the playback controls
  } else if (micBtn.classList.contains("recording")) {
    stopListening(); // still waiting for permission
  } else {
    startListening();
  }
});

$("#speak-english").addEventListener("click", () => {
  speak($("#english").textContent, "en-GB");
});

// ---------- Navigation ----------

$("#replay").addEventListener("click", speakPhrase);
$("#back").addEventListener("click", () => {
  const [langId, phraseId] = location.hash.slice(1).split("/");
  location.hash = phraseId ? langId : "";
});
$("#home").addEventListener("click", () => {
  location.hash = "";
});

window.addEventListener("hashchange", route);

renderLangs();
route();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
