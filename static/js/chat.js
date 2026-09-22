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

  // Settings Modal elements
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const apiKeyForm = document.getElementById('apiKeyForm');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const modalKeyStatus = document.getElementById('modalKeyStatus');

  let chatHistory = [];

  // Check health and status on load
  checkServerHealth();

  async function checkServerHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.api_key_configured) {
        if (statusIndicator) statusIndicator.className = 'status-indicator';
        if (statusText) statusText.textContent = 'Online • Groq AI Active';
        if (modalKeyStatus) {
          modalKeyStatus.className = 'api-status-box active';
          modalKeyStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Groq API Key is connected & active (' + (data.model || 'Groq') + ')</span>';
        }
      } else {
        if (statusIndicator) statusIndicator.className = 'status-indicator offline';
        if (statusText) statusText.textContent = 'Verified Knowledge Base Active';
        if (modalKeyStatus) {
          modalKeyStatus.className = 'api-status-box inactive';
          modalKeyStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span>No API Key configured. Running in Local Verified Knowledge Base mode.</span>';
        }
      }
    } catch (e) {
      if (statusText) statusText.textContent = 'Server Offline';
      if (statusIndicator) statusIndicator.className = 'status-indicator offline';
    }
  }

  // Settings modal open/close
  if (openSettingsBtn && settingsModal) {
    openSettingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
      checkServerHealth();
      if (apiKeyInput) apiKeyInput.focus();
    });

    const closeModal = () => { settingsModal.style.display = 'none'; };
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeModal);
    if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeModal);
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeModal();
    });

    // Save API key via in-app settings
    if (apiKeyForm) {
      apiKeyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = apiKeyInput.value.trim();
        if (!key) return;

        const saveBtn = document.getElementById('saveKeyBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;

        try {
          const res = await fetch('/api/settings/key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key })
          });
          const data = await res.json();
          saveBtn.innerHTML = originalText;
          saveBtn.disabled = false;

          if (data.success) {
            apiKeyInput.value = '';
            closeModal();
            checkServerHealth();
            appendMessage('assistant', '✅ **Groq API Key successfully configured!** High-speed AI model is now active.');
          } else {
            alert(data.error || 'Failed to update API key');
          }
        } catch (err) {
          saveBtn.innerHTML = originalText;
          saveBtn.disabled = false;
          alert('Could not save API key. Please check your connection.');
        }
      });
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
        appendMessage('assistant', `⚠️ Could not reach server. Please ensure the backend is running.`);
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

    // Preserve code blocks
    const codeBlocks = [];
    let formatted = text.replace(/```(?:([a-zA-Z0-9_-]+)?\n)?([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CB_${codeBlocks.length}__`;
      codeBlocks.push('<pre><code>' + escapeHtml(code.trim()) + '</code></pre>');
      return id;
    });

    formatted = escapeHtml(formatted);

    // Markdown Links: [label](url)
    formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Inline bold: **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Inline italic: *text*
    formatted = formatted.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');

    // Inline code: `text`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Telegram handles: @username -> clickable link
    formatted = formatted.replace(/@([A-Za-z0-9_]{4,32})/g, '<a class="telegram-tag" href="https://t.me/$1" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i> @$1</a>');

    // Paragraphs and lists
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

    // Restore code blocks
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