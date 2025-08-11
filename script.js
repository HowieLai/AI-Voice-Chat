const recordBtn = document.getElementById('recordBtn');
const sendBtn = document.getElementById('sendBtn');
const textInput = document.getElementById('textInput');
const messages = document.getElementById('messages');

let mediaRecorder;
let audioChunks = [];

function addMessage(text, sender, isThinking = false) {
    const msg = document.createElement('div');
    msg.className = `message ${sender}` + (isThinking ? ' thinking' : '');
    msg.innerHTML = marked.parse(text);
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
}

async function sendToGemini({ text, audioBlob }) {
    try {
        let response;
        if (audioBlob) {
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            response = await fetch('/api/chat', {
                method: 'POST',
                body: formData
            });
        } else {
            response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
        }
        if (!response.ok) throw new Error('Request failed');
        return await response.json();
    } catch (err) {
        addMessage('Service error.', 'bot');
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
                const { thinking, reply } = await sendToGemini({ audioBlob });
                if (thinking) addMessage(`思考：\n\n${thinking}`, 'bot', true);
                if (reply) {
                    addMessage(`回答：\n\n${reply}`, 'bot');
                    speak(reply);
                }
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
        const { thinking, reply } = await sendToGemini({ text });
        if (thinking) addMessage(`思考：\n\n${thinking}`, 'bot', true);
        if (reply) {
            addMessage(`回答：\n\n${reply}`, 'bot');
            speak(reply);
        }
    } catch (err) {
        console.error(err);
    }
}
