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
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer YOUR_OPENAI_API_KEY`
        },
        body: formData
    });
    const data = await response.json();
    return data.text;
}

async function sendToChatGPT(text) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer YOUR_OPENAI_API_KEY`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: text }]
        })
    });
    const data = await response.json();
    return data.choices[0].message.content.trim();
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

    audioChunks = [];
    recordBtn.textContent = '■ Stop';

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    mediaRecorder.ondataavailable = e => {
        audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const text = await sendToSTT(audioBlob);
        textInput.value = text;
        sendMessage();
    };
};

sendBtn.onclick = sendMessage;
textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const text = textInput.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    textInput.value = '';

    const reply = await sendToChatGPT(text);
    addMessage(reply, 'bot');
    speak(reply);
}
