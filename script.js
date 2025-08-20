const holdBtn = document.getElementById('recordBtn');
const autoBtn = document.getElementById('autoBtn');
const sendBtn = document.getElementById('sendBtn');
const textInput = document.getElementById('textInput');
const messages = document.getElementById('messages');

let mediaRecorder;
let audioChunks = [];
let silenceTimer;
const conversation = [];
const SILENCE_DURATION = 1500;
const SILENCE_THRESHOLD = 0.01;

if (!navigator.mediaDevices) {
    holdBtn.disabled = true;
    autoBtn.disabled = true;
    holdBtn.textContent = '🎤 Unsupported';
    autoBtn.textContent = '🎤 Unsupported';
}

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

    try {
        const response = await fetch('/transcriptions', {
            method: 'POST',
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
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        const utter = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utter);
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
