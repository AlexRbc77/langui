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

  MODES.child.panel.hide();
  playback.hidden = true;
}

function show(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  $("#back").hidden = name === "langs";
  $("#home").hidden = name !== "ask";
  $("#staff-mic").hidden = name !== "phrases";
  stopListening();
  MODES.staff.panel.hide();
  $("#current").textContent = state.lang ? state.lang.flag : "🌍";
  $("#staff-flag").textContent = state.lang ? state.lang.flag : "";
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
// Two microphones share this code:
//  - the child's 🎤 on the question screen: child's language → English
//  - the staff 🎤 in the header: English → child's language
//
// Primary path: Chrome's speech recognition, then the text is translated.
// Fallback (child only): if recognition is missing or fails, record raw audio
// with MediaRecorder so staff can at least play the message back.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const ENGLISH = LANGUAGES.find((l) => l.id === "en");
let recognizer = null;
let mediaRecorder = null;
let latestText = "";

const playback = $("#playback");

function makePanel(panel, heard, out, speakBtn) {
  return {
    show(heardText, outText) {
      panel.hidden = false;
      heard.textContent = heardText;
      heard.dir = "auto";
      out.textContent = outText;
      out.dir = "auto";
    },
    heard,
    out,
    speakBtn,
    hide() {
      panel.hidden = true;
    },
  };
}

const MODES = {
  child: {
    btn: $("#mic"),
    panel: makePanel($("#transcript"), $("#heard"), $("#english"), $("#speak-english")),
    from: () => state.lang,
    to: () => ENGLISH,
    audioFallback: true,
  },
  staff: {
    btn: $("#staff-mic"),
    panel: makePanel($("#staff-panel"), $("#staff-heard"), $("#staff-out"), $("#staff-speak")),
    from: () => ENGLISH,
    to: () => state.lang,
    audioFallback: false,
  },
};

let active = null; // the mode currently recording

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

function setMicState(mode, recording) {
  mode.btn.classList.toggle("recording", recording);
  mode.btn.textContent = recording ? "⏹️" : "🎤";
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
  for (const mode of Object.values(MODES)) setMicState(mode, false);
  active = null;
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
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError") throw new Error(RECOGNITION_ERRORS["not-allowed"]);
    throw new Error(RECOGNITION_ERRORS["audio-capture"]);
  }
}

function releaseStream(stream) {
  stream.getTracks().forEach((t) => t.stop());
}

async function startListening(mode) {
  if (window.speechSynthesis) speechSynthesis.cancel();
  playback.hidden = true;
  active = mode;
  setMicState(mode, true);
  mode.panel.show("⏳🎤", "");

  let stream;
  try {
    stream = await ensureMicPermission();
  } catch (err) {
    stopListening();
    mode.panel.show("❌", err.message);
    return;
  }

  if (!Recognition) {
    if (mode.audioFallback) {
      startAudioRecording(mode, stream, "Speech recognition isn't available in this browser, so the message is recorded instead.");
    } else {
      releaseStream(stream);
      stopListening();
      mode.panel.show("❌", "Speech recognition isn't available in this browser. Use Google Chrome.");
    }
    return;
  }

  // Android can only give the microphone to one user at a time, so free it
  // (and let text-to-speech release audio focus) before recognition starts.
  releaseStream(stream);
  await new Promise((r) => setTimeout(r, 300));
  if (active !== mode) return; // cancelled meanwhile

  startRecognition(mode);
}

function startRecognition(mode) {
  latestText = "";
  let failed = null;
  const rec = new Recognition();
  recognizer = rec;
  rec.lang = mode.from().tts;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onaudiostart = () => mode.panel.show("👂…", "");
  rec.onspeechstart = () => {
    if (!latestText) mode.panel.heard.textContent = "🗣️…";
  };

  rec.onresult = (event) => {
    let finalText = "";
    let interim = "";
    for (const result of event.results) {
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    latestText = finalText + interim;
    mode.panel.heard.textContent = latestText || "👂…";
  };

  rec.onerror = (event) => {
    failed = event.error;
  };

  rec.onend = () => {
    if (recognizer !== rec) return;
    recognizer = null;
    const heard = latestText.trim();
    if (heard) {
      stopListening();
      translateAndShow(mode, heard);
    } else if (failed && mode.audioFallback && FALLBACK_ERRORS.includes(failed)) {
      // Recognition can't work here: record plain audio instead.
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => startAudioRecording(mode, s, `${RECOGNITION_ERRORS[failed] || failed} Recording audio instead.`))
        .catch(() => {
          stopListening();
          mode.panel.show("❌", RECOGNITION_ERRORS["audio-capture"]);
        });
    } else {
      stopListening();
      const msg = failed ? RECOGNITION_ERRORS[failed] || `Error: ${failed}` : RECOGNITION_ERRORS["no-speech"];
      if (failed !== "aborted") mode.panel.show("❌", msg);
    }
  };

  try {
    rec.start();
  } catch (err) {
    recognizer = null;
    stopListening();
    mode.panel.show("❌", `Error: ${err.message}`);
  }
}

// Fallback: record the message so staff can listen to it (no translation).
function startAudioRecording(mode, stream, note) {
  if (!window.MediaRecorder) {
    releaseStream(stream);
    stopListening();
    mode.panel.show("❌", "This browser can't record audio.");
    return;
  }
  const chunks = [];
  const mr = new MediaRecorder(stream);
  mediaRecorder = mr;
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.onstop = () => {
    releaseStream(stream);
    mediaRecorder = null;
    stopListening();
    if (!chunks.length) return;
    if (playback.src) URL.revokeObjectURL(playback.src);
    playback.src = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType }));
    playback.hidden = false;
    mode.panel.show("🎧 ▶️", note);
  };
  mr.start();
  mode.panel.show("🔴 …", `${note} Tap ⏹️ when finished.`);
}

async function translate(text, from, to) {
  if (from === to) return text;
  try {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t" +
      `&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(text)}`;
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
    `?langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return data.responseData.translatedText;
}

async function translateAndShow(mode, heard) {
  const from = mode.from();
  const to = mode.to();
  mode.panel.show(heard, "⏳");
  try {
    const out = await translate(heard, from.tr, to.tr);
    mode.panel.out.textContent = out;
    speak(out, to.tts);
  } catch (_) {
    mode.panel.out.textContent = "❌📶 Translation failed (no internet?)";
  }
}

for (const mode of Object.values(MODES)) {
  mode.btn.addEventListener("click", () => {
    if (active === mode) {
      if (recognizer) recognizer.stop(); // onend will translate what was heard so far
      else if (mediaRecorder) mediaRecorder.stop(); // onstop will show the playback controls
      else stopListening(); // still waiting for permission
    } else {
      stopListening();
      startListening(mode);
    }
  });
  mode.panel.speakBtn.addEventListener("click", () => {
    speak(mode.panel.out.textContent, mode.to().tts);
  });
}

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
  // When a new version of the app is installed, reload once to show it.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker
    .register("sw.js", { updateViaCache: "none" })
    .then((reg) => reg.update())
    .catch(() => {});
}
