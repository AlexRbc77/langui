# Emoji Talk 🗣️🌍

A tiny emoji-only web app that helps school staff talk with children who speak a different language.

1. **Pick a flag** 🇫🇷 🇪🇸 🇮🇹 🇩🇪 🇵🇹 🇷🇺 🇺🇦 🇵🇱 🇷🇴 🇹🇷 🇸🇦 🇨🇳 🇮🇳 🇬🇧
2. **Tap a sentence emoji**: the phone says it out loud in the child's language
   (🤕 Are you hurt? · 🤢 Do you feel sick? · 🚽 Toilet? · 🪑 Sit correctly · 🍽️ Hungry? · 🥤 Thirsty? ·
   🥱 Tired? · 🎲 Game at the table? · 🧸 Play with the toys? · 😠 Did someone upset you? · 🙋 Participate ·
   ✋ Stop doing that · 😭 Stop crying · ☝️ One more · 🧼 Wash hands · 👂 Listen · 🌟 Well done · 🚪 Time to go)
3. **The child answers** by tapping an emoji (👍 👎 👦 👧 💦 …). It is shown full screen and spoken in English.
   **Or** they tap 🎤 and speak; their words are transcribed and translated into English (shown and spoken).

4. **Staff can say anything else**: on the sentences screen, tap 🎤 at the top right and speak in English.
   It is transcribed, translated into the child's language, shown and spoken out loud (🔊 repeats it).

Tap the big emoji to repeat the question. ⬅️ goes back, 🌍 returns to the flags.

---

## Installation

Emoji Talk is a plain website (HTML, CSS and JavaScript) with no build step and no server code.
To use it on a phone you put it online once, then open it in Chrome and add it to the home screen.

> **Why it must be online over HTTPS:** Android only lets websites use the microphone on secure
> (`https://`) addresses. Opening `index.html` straight from the phone's files will show the menus,
> but 🎤 recording will not work.

### Step 1: Put the app online with GitHub Pages (free, about 5 minutes)

You only do this once. Afterwards anyone can use the link.

1. Sign in to [github.com](https://github.com) (create a free account if needed).
2. Get your own copy of this repository:
   - If you are not the owner, click **Fork** (top right) → **Create fork**.
   - If you are the owner, use the repository as it is.
3. In the repository, open **Settings** → **Pages** (left menu).
4. Under **Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** pick the branch that contains `index.html` (for example `main`) and the folder `/ (root)`
   - Click **Save**.
5. Wait 1–2 minutes and refresh the page. A link appears at the top, for example
   `https://your-username.github.io/langui/`. This is your app's address.
6. Open the link on a computer first to check that the flags appear.

> **Note:** On a free GitHub account, Pages only works for **public** repositories.
> Any other static host that serves HTTPS also works (Netlify, Cloudflare Pages, a school web server…):
> just upload all the files in this folder, keeping the `icons/` folder.

### Step 2: Install it on the Android phone or tablet

1. Open **Google Chrome** on the device (other browsers may not support speech recognition).
2. Go to your app's address from Step 1.
3. Tap Chrome's menu **⋮** (top right) → **Add to Home screen** (or **Install app**) → **Install**.
4. An **Emoji Talk** icon now appears on the home screen. It opens full screen like a normal app.

### Step 3: Allow the microphone

1. Open Emoji Talk, choose a flag and a sentence, then tap 🎤.
2. When Chrome asks **"Allow … to use your microphone?"**, tap **Allow**.
   - If you tapped *Block* by mistake: Android **Settings → Apps → Chrome → Permissions → Microphone → Allow**,
     then in Chrome open the site, tap the icon left of the address → **Permissions** → **Microphone → Allow**.

### Step 4: Make sure every language can speak

The app uses the phone's built-in text-to-speech voices. Most are already installed, but some languages
(for example Ukrainian, Romanian or Hindi) may need downloading:

1. Android **Settings** → search for **Text-to-speech** (usually under *Accessibility* or *System → Languages*).
2. **Preferred engine:** `Speech Services by Google`.
3. Tap the ⚙️ next to it → **Install voice data** → download the languages you need.
4. Test: open Emoji Talk, pick the language and tap a sentence. You should hear it.

To make 🎤 recognise a language offline or more reliably, also install it in
**Settings → Google → Voice / Speech recognition → Offline speech recognition** (menu names vary by phone).

### Step 5 (optional): Test on a computer

```bash
# from this folder, with Node.js installed
npx http-server .
```

Then open http://localhost:8080 in Chrome. The microphone works on `localhost` too.

### Updating

Edit the files on GitHub (or push changes). GitHub Pages republishes within a minute or two.
Installed phones pick up the new version the next time the app is opened with internet.

---

## Requirements & privacy

| Feature | Needs internet? | Notes |
|---|---|---|
| Menus, spoken questions, answer emojis | No (after first open) | Uses the phone's own voices |
| 🎤 Recording | Yes | Uses Chrome's speech recognition (Google) |
| Translation into English | Yes | Google Translate public endpoint, with MyMemory as a fallback |

What the child says into 🎤 is sent to Google's speech recognition and to the translation services.
Check this is acceptable under your school's safeguarding and data-protection policies before using it.

## Troubleshooting

- **No sound:** check the volume and that the phone isn't on silent. Install the language voice (Step 4).
- **🎤 shows "not supported":** use Google Chrome on Android, and open the app via its `https://` link.
- **"Microphone permission was refused":** see Step 3.
- **"Translation failed":** the device is offline, or the translation service is temporarily unavailable. Try again.
- **Flags show as letters (e.g. "FR"):** happens on some Windows computers only; Android shows flags correctly.

## Editing sentences and languages

All sentences, translations and answer emojis live in `phrases.js`.

- **Change an answer:** edit the `answers` list of a phrase (`e` is the emoji, `en` is what staff hear in English).
- **Add a sentence:** copy one of the blocks in `PHRASES`, give it a new `id` and `emoji`, and fill in every language in `t`.
- **Add a language:** add an entry to `LANGUAGES` (flag, name, speech code such as `bg-BG`, translation code such as `bg`),
  then add a translation for it in every phrase's `t` object.

After changing files, bump `CACHE` in `sw.js` (e.g. `emoji-talk-v2`) so installed apps refresh their offline copy.

The translations were written by hand, so have a native speaker check them before relying on them.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page layout |
| `styles.css` | Look and feel |
| `app.js` | Screens, speech, recording and translation |
| `phrases.js` | Languages, sentences, translations and answer emojis |
| `manifest.webmanifest`, `icons/` | Lets Android install it as an app |
| `sw.js` | Offline support |
