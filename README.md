# AI Voice Chat

This is a simple web application that lets you interact with an AI via speech or text. Speak into your microphone and the app will transcribe your words using OpenAI Whisper, send them to ChatGPT, display the response, and read it aloud using the browser's text‑to‑speech.

## Setup

1. Install dependencies and start the backend server:
   ```bash
   npm install
   OPENAI_API_KEY=your_key npm start
   ```
   The server will host the web page at [http://localhost:3000](http://localhost:3000).
2. Open the page in your browser and allow microphone access when prompted.

The interface adapts to desktop and mobile browsers.
