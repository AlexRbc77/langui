# Emoji Talk 🗣️🌍

A tiny emoji-only web app that helps school staff talk with children who speak a different language.

1. **Pick a flag** 🇫🇷 🇪🇸 🇮🇹 🇩🇪 🇵🇹 🇷🇺 🇺🇦 🇵🇱 🇷🇴 🇹🇷 🇸🇦 🇨🇳 🇮🇳 🇬🇧
2. **Tap a sentence emoji**: the phone says it out loud in the child's language
   (🤕 Are you hurt? · 🤢 Do you feel sick? · 🚽 Toilet? · 🪑 Sit correctly · 🍽️ Hungry? · 🥤 Thirsty? ·
   🥱 Tired? · 🎲 Game at the table? · 🧸 Play with the toys? · 😠 Did someone upset you? · 🙋 Participate ·
   ✋ Stop doing that · 😭 Stop crying · ☝️ One more · 🧼 Wash hands · 👂 Listen · 🌟 Well done · 🚪 Time to go)
3. **The child answers** by tapping an emoji (👍 👎 👦 👧 💦 …). It is shown full screen and spoken in English.
   **Or** they tap 🎤 and speak; their words are transcribed and translated into English (shown and spoken).

Tap the big emoji to repeat the question. ⬅️ goes back, 🌍 returns to the flags.

## Running it on Android

It is a plain static site with no build step. The microphone only works over **HTTPS**, so host it, for example with GitHub Pages:

1. GitHub → *Settings → Pages* → *Deploy from a branch* → pick the branch and `/ (root)`.
2. Open the Pages URL in **Chrome on Android**.
3. Chrome menu ⋮ → **Add to Home screen / Install app**. It then opens full screen like a normal app.

Local test on a computer: `npx http-server .` then open http://localhost:8080.

### Notes
- Speech uses the phone's text-to-speech voices. If a language is silent, install its voice in
  Android *Settings → Accessibility → Text-to-speech → Google speech engine → Install voice data*.
- 🎤 recording uses Chrome's speech recognition and needs internet. Translation uses Google Translate's
  public endpoint with MyMemory as a fallback, so what the child says is sent to these services.
- Menus and spoken questions work offline once the app has been opened once.

## Editing
All sentences, translations and answer emojis live in `phrases.js`. To add a language, add an entry to
`LANGUAGES` and a translation in every phrase's `t` object. The translations were written by hand, so
have a native speaker check them before relying on them.
