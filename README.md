# AI Voice Chat

This is a simple web application that lets you interact with an AI via speech or text. Speak into your microphone and the app will transcribe your words using OpenAI Whisper, send them to ChatGPT, display the response, and read it aloud using the browser's text‑to‑speech.

## Setup

1. Start the backend server:
   ```
   cd server
   npm install
   npm start
   ```
2. In another terminal, open `index.html` in your browser and enter your OpenAI API Key in the field at the top of the page (it is stored locally).
3. Allow microphone access when prompted.
4. Use **Hold to Talk** to record while the button is pressed, or **Auto** to start recording and stop when silence is detected.

The page is optimized for desktop and mobile browsers.
