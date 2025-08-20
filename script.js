const holdBtn = document.getElementById('recordBtn');
const autoBtn = document.getElementById('autoBtn');
const sendBtn = document.getElementById('sendBtn');
const textInput = document.getElementById('textInput');
const messages = document.getElementById('messages');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const stopSpeakBtn = document.getElementById('stopSpeakBtn');

let mediaRecorder;
let audioChunks = [];
let silenceTimer;
const conversation = [];
const SILENCE_DURATION = 1500;
const SILENCE_THRESHOLD = 0.01;
let currentUtter;

if (!navigator.mediaDevices) {
    holdBtn.disabled = true;
    autoBtn.disabled = true;
    holdBtn.textContent = '🎤 Unsupported';
    autoBtn.textContent = '🎤 Unsupported';
}

apiKeyInput.value = localStorage.getItem('OPENAI_API_KEY') || '';
saveKeyBtn.onclick = () => {
    localStorage.setItem('OPENAI_API_KEY', apiKeyInput.value.trim());
};

function getApiKey() {
    return apiKeyInput.value.trim() || localStorage.getItem('OPENAI_API_KEY') || '';
}

function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `message ${sender}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
}

async function sendToSTT(audioBlob) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No API key');
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    try {
        const response = await fetch('/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData
        });
        if (!response.ok) throw new Error('STT failed');
        const data = await response.json();
        return data.text;
    } catch (err) {
        addMessage('Network error', 'bot');
        throw err;
    }
}

async function sendToChatGPT() {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No API key');
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({ messages: conversation })
        });
        if (!response.ok) throw new Error('Chat failed');
        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (err) {
        addMessage('Network error', 'bot');
        throw err;
    }
}

function speak(text) {
    if ('speechSynthesis' in window) {
        currentUtter = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(currentUtter);
    }
}

function stopSpeaking() {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
    }
}

async function startHoldRecording() {
    if (!navigator.mediaDevices) return;
    audioChunks = [];
    holdBtn.textContent = 'Release to Stop';
    autoBtn.disabled = true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            try {
                const text = await sendToSTT(audioBlob);
                if (text) {
                    textInput.value = text;
                    sendMessage();
                }
            } catch (err) {
                // error handled in sendToSTT
            } finally {
                holdBtn.textContent = '🎤 Hold to Talk';
                autoBtn.disabled = false;
            }
        };
        mediaRecorder.start();
    } catch (err) {
        addMessage('Microphone access denied', 'bot');
        holdBtn.textContent = '🎤 Hold to Talk';
        autoBtn.disabled = false;
    }
}

function stopHoldRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

async function startAutoRecording() {
    if (!navigator.mediaDevices) return;
    audioChunks = [];
    holdBtn.disabled = true;
    autoBtn.textContent = '■ Stop';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        function monitor() {
            const data = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v * v;
            }
            const volume = Math.sqrt(sum / data.length);
            if (volume < SILENCE_THRESHOLD) {
                if (!silenceTimer) {
                    silenceTimer = setTimeout(() => {
                        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
                    }, SILENCE_DURATION);
                }
            } else {
                clearTimeout(silenceTimer);
                silenceTimer = null;
            }
            if (mediaRecorder.state === 'recording') {
                requestAnimationFrame(monitor);
            }
        }
        monitor();

        mediaRecorder.onstop = async () => {
            clearTimeout(silenceTimer);
            silenceTimer = null;
            audioCtx.close();
            stream.getTracks().forEach(t => t.stop());
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            try {
                const text = await sendToSTT(audioBlob);
                if (text) {
                    textInput.value = text;
                    sendMessage();
                }
            } catch (err) {
                // error handled in sendToSTT
            } finally {
                autoBtn.textContent = '🎤 Auto';
                autoBtn.onclick = startAutoRecording;
                holdBtn.disabled = false;
            }
        };

        mediaRecorder.start();
        autoBtn.onclick = () => {
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        };
    } catch (err) {
        addMessage('Microphone access denied', 'bot');
        autoBtn.textContent = '🎤 Auto';
        autoBtn.onclick = startAutoRecording;
        holdBtn.disabled = false;
    }
}

holdBtn.addEventListener('mousedown', startHoldRecording);
holdBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startHoldRecording(); });
holdBtn.addEventListener('mouseup', stopHoldRecording);
holdBtn.addEventListener('mouseleave', stopHoldRecording);
holdBtn.addEventListener('touchend', stopHoldRecording);

autoBtn.onclick = startAutoRecording;

sendBtn.onclick = sendMessage;
stopSpeakBtn.onclick = stopSpeaking;
textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const text = textInput.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    conversation.push({ role: 'user', content: text });
    textInput.value = '';

    sendBtn.disabled = true;
    holdBtn.disabled = true;
    autoBtn.disabled = true;

    try {
        const reply = await sendToChatGPT();
        addMessage(reply, 'bot');
        conversation.push({ role: 'assistant', content: reply });
        speak(reply);
    } catch (err) {
        // error already shown
    } finally {
        sendBtn.disabled = false;
        holdBtn.disabled = false;
        autoBtn.disabled = false;
    }
}
