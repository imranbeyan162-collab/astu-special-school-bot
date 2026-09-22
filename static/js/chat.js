document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chatForm');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const messagesContainer = document.getElementById('messagesContainer');
  const typingIndicator = document.getElementById('typingIndicator');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const chips = document.querySelectorAll('.chip');
  const mobileToggle = document.getElementById('mobileToggle');
  const sidebar = document.getElementById('sidebar');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  let chatHistory = [];

  // Check health and status on load
  checkServerHealth();

  async function checkServerHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.status === 'online') {
        if (statusIndicator) statusIndicator.className = 'status-indicator';
        if (statusText) statusText.textContent = 'ASTU Special School • AI Assistant';
      }
    } catch (e) {
      if (statusText) statusText.textContent = 'Offline';
    }
  }

  // Auto-resize input
  if (userInput && sendBtn) {
    userInput.addEventListener('input', () => {
      sendBtn.disabled = userInput.value.trim().length === 0;
      autoResizeTextarea(userInput);
    });

    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) {
          chatForm.dispatchEvent(new Event('submit'));
        }
      }
    });
  }

  // Mobile sidebar toggle
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && 
          !sidebar.contains(e.target) && 
          !mobileToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Quick chips
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt && userInput && chatForm) {
        userInput.value = prompt;
        sendBtn.disabled = false;
        chatForm.dispatchEvent(new Event('submit'));
      }
    });
  });

  // Restart / Clear conversation
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      if (confirm('Start a fresh conversation?')) {
        chatHistory = [];
        const userRows = messagesContainer.querySelectorAll('.message-row');
        userRows.forEach(row => row.remove());
        const welcome = messagesContainer.querySelector('.welcome-box');
        if (welcome) welcome.style.display = 'block';
      }
    });
  }

  // Chat form submit
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = userInput.value.trim();
      if (!message) return;

      const welcome = messagesContainer.querySelector('.welcome-box');
      if (welcome) welcome.style.display = 'none';

      appendMessage('user', message);
      userInput.value = '';
      sendBtn.disabled = true;
      userInput.style.height = 'auto';

      showTyping(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message,
            history: chatHistory
          })
        });

        const data = await res.json();
        showTyping(false);

        if (data.reply) {
          appendMessage('assistant', data.reply);
          chatHistory.push({ role: 'user', content: message });
          chatHistory.push({ role: 'assistant', content: data.reply });
        } else if (data.error) {
          appendMessage('assistant', `⚠️ ${data.error}`);
        }
      } catch (err) {
        showTyping(false);
        appendMessage('assistant', `⚠️ Could not reach server. Please ensure your internet is connected.`);
        console.error(err);
      }
    });
  }

  function appendMessage(role, text) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = formatMarkdown(text);

    row.appendChild(avatar);
    row.appendChild(bubble);

    messagesContainer.appendChild(row);
    scrollToBottom();
  }

  function showTyping(show) {
    if (!typingIndicator) return;
    typingIndicator.style.display = show ? 'flex' : 'none';
    if (show) scrollToBottom();
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  }

  // Robust Markdown Formatter
  function formatMarkdown(text) {
    if (!text) return '';

    const codeBlocks = [];
    let formatted = text.replace(/```(?:([a-zA-Z0-9_-]+)?\n)?([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CB_${codeBlocks.length}__`;
      codeBlocks.push('<pre><code>' + escapeHtml(code.trim()) + '</code></pre>');
      return id;
    });

    formatted = escapeHtml(formatted);
    formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    formatted = formatted.replace(/@([A-Za-z0-9_]{4,32})/g, '<a class="telegram-tag" href="https://t.me/$1" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i> @$1</a>');

    const lines = formatted.split('\n');
    let output = '';
    let inList = false;

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          output += '<ul>';
          inList = true;
        }
        output += `<li>${trimmed.substring(2)}</li>`;
      } else {
        if (inList) {
          output += '</ul>';
          inList = false;
        }
        if (trimmed.length > 0) {
          output += `<p>${line}</p>`;
        }
      }
    }

    if (inList) output += '</ul>';

    codeBlocks.forEach((block, idx) => {
      output = output.replace(new RegExp(`__CB_${idx}__`, 'g'), block);
    });

    return output;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
});