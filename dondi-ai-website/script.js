document.getElementById('year').textContent = new Date().getFullYear();

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

const conversation = [
  {
    role: 'assistant',
    content: 'Hi! Ask me anything about Dondi AI, website ideas, or how to get started.'
  }
];

function addMessage(text, sender) {
  const message = document.createElement('div');
  message.className = `message ${sender}`;
  message.textContent = text;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function generateReply() {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: conversation })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Unable to reach Dondi AI.');
  }

  return data.answer;
}

chatForm.addEventListener('submit', function (event) {
  event.preventDefault();

  const message = chatInput.value.trim();
  if (!message) {
    return;
  }

  addMessage(message, 'user');
  conversation.push({ role: 'user', content: message });
  chatInput.value = '';

  window.setTimeout(async function () {
    try {
      const response = await generateReply();
      conversation.push({ role: 'assistant', content: response });
      addMessage(response, 'bot');
    } catch (error) {
      addMessage(`Sorry, I could not answer right now: ${error.message}`, 'bot');
    }
  }, 350);
});
