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

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let finalText = "";
let latestText = "";

const micBtn = $("#mic");

function stopListening() {
  if (recognizer) {
    recognizer.onend = null;
    recognizer.abort();
    recognizer = null;
  }
  micBtn.classList.remove("recording");
  micBtn.textContent = "🎤";
}

function startListening() {
  if (!Recognition) {
    showTranscript("❌🎤", "Speech recognition is not supported in this browser. Use Chrome on Android.");
    return;
  }
  speechSynthesis && speechSynthesis.cancel();
  finalText = "";
  latestText = "";
  recognizer = new Recognition();
  recognizer.lang = state.lang.tts;
  recognizer.interimResults = true;
  recognizer.continuous = false;
  recognizer.maxAlternatives = 1;

  micBtn.classList.add("recording");
  micBtn.textContent = "⏹️";
  showTranscript("👂…", "");

  recognizer.onresult = (event) => {
    let interim = "";
    finalText = "";
    for (const result of event.results) {
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    latestText = finalText + interim;
    $("#heard").textContent = latestText || "👂…";
  };

  recognizer.onerror = (event) => {
    const messages = {
      "not-allowed": "Microphone permission was refused.",
      "no-speech": "No speech heard. Tap 🎤 to try again.",
      network: "No internet connection.",
      "language-not-supported": "This language is not supported for recording on this device.",
    };
    latestText = "";
    showTranscript("❌", messages[event.error] || `Error: ${event.error}`);
  };

  recognizer.onend = () => {
    const heard = latestText.trim();
    stopListening();
    if (heard) translateAndShow(heard);
  };

  recognizer.start();
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
