# AI Voice Chat

This is a simple web application that lets you interact with an AI via speech or text. Speak into your microphone or type and the app will forward your input to Google's Gemini 2.5 Flash model, display its markdown response, and read it aloud using the browser's text‑to‑speech.

## Setup

1. Install dependencies and start the backend server:
   ```bash
   npm install
   npm start
   ```
   The server uses built-in demo API keys for Gemini, or you can provide your own by setting `GOOGLE_API_KEY`. The page will be served at [http://localhost:3000](http://localhost:3000).
2. Open the page in your browser and allow microphone access when prompted.

The interface adapts to desktop and mobile browsers.
