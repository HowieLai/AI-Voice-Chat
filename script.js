const recordBtn = document.getElementById('recordBtn');
const sendBtn = document.getElementById('sendBtn');
const textInput = document.getElementById('textInput');
const messages = document.getElementById('messages');

let mediaRecorder;
let audioChunks = [];

function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `message ${sender}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
}

async function sendToSTT(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        const response = await fetch('/api/stt', {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Transcription request failed');
        const data = await response.json();
        return data.text;
    } catch (err) {
        addMessage('Failed to transcribe audio.', 'bot');
        throw err;
    }
}

async function sendToChatGPT(text) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!response.ok) throw new Error('Chat request failed');
        const data = await response.json();
        return data.reply;
    } catch (err) {
        addMessage('Chat service error.', 'bot');
        throw err;
    }
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utter);
    }
}

recordBtn.onclick = async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordBtn.textContent = '🎤 Speak';
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addMessage('Microphone not supported in this browser.', 'bot');
        return;
    }

    try {
        audioChunks = [];
        recordBtn.textContent = '■ Stop';
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();

        mediaRecorder.ondataavailable = e => {
            audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            try {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const text = await sendToSTT(audioBlob);
                textInput.value = text;
                sendMessage();
            } catch (err) {
                console.error(err);
            }
        };
    } catch (err) {
        addMessage('Unable to access microphone.', 'bot');
        recordBtn.textContent = '🎤 Speak';
        console.error(err);
    }
};

sendBtn.onclick = sendMessage;
textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = textInput.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    textInput.value = '';

    try {
        const reply = await sendToChatGPT(text);
        addMessage(reply, 'bot');
        speak(reply);
    } catch (err) {
        console.error(err);
    }
}
