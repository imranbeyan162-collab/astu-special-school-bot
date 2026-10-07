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

  // ==========================================
  // Student Complaint Modal Functionality
  // ==========================================
  const complaintModal = document.getElementById('complaintModal');
  const openComplaintBtns = [
    document.getElementById('sidebarComplaintBtn'),
    document.getElementById('topbarComplaintBtn')
  ];
  const closeComplaintModalBtn = document.getElementById('closeComplaintModalBtn');
  const cancelComplaintBtn = document.getElementById('cancelComplaintBtn');
  const doneComplaintBtn = document.getElementById('doneComplaintBtn');
  const complaintForm = document.getElementById('complaintForm');
  const complaintSuccessState = document.getElementById('complaintSuccessState');
  const ticketNumberDisplay = document.getElementById('ticketNumberDisplay');
  const complaintFormAlert = document.getElementById('complaintFormAlert');
  const submitComplaintBtn = document.getElementById('submitComplaintBtn');

  function openComplaintModal() {
    if (!complaintModal) return;
    complaintModal.style.display = 'flex';
    complaintSuccessState.style.display = 'none';
    complaintForm.style.display = 'flex';
    if (complaintFormAlert) complaintFormAlert.style.display = 'none';
    const cat = document.getElementById('complaintCategory');
    if (cat) cat.focus();
  }

  function closeComplaintModal() {
    if (!complaintModal) return;
    complaintModal.style.display = 'none';
  }

  window.openComplaintModal = openComplaintModal;

  openComplaintBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', openComplaintModal);
  });

  if (closeComplaintModalBtn) closeComplaintModalBtn.addEventListener('click', closeComplaintModal);
  if (cancelComplaintBtn) cancelComplaintBtn.addEventListener('click', closeComplaintModal);
  if (doneComplaintBtn) doneComplaintBtn.addEventListener('click', closeComplaintModal);

  // Close modal when clicking backdrop
  if (complaintModal) {
    complaintModal.addEventListener('click', (e) => {
      if (e.target === complaintModal) {
        closeComplaintModal();
      }
    });
  }

  // Submit Complaint Form
  if (complaintForm) {
    complaintForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const category = document.getElementById('complaintCategory').value;
      const subject = document.getElementById('complaintSubject').value.trim();
      const message = document.getElementById('complaintMessage').value.trim();
      const studentName = document.getElementById('complaintName').value.trim();
      const gradeSection = document.getElementById('complaintGrade').value.trim();
      const contactInfo = document.getElementById('complaintContact').value.trim();

      if (!category || !subject || !message) {
        if (complaintFormAlert) {
          complaintFormAlert.textContent = 'Please fill out all required fields marked with *';
          complaintFormAlert.style.display = 'block';
        }
        return;
      }

      if (submitComplaintBtn) {
        submitComplaintBtn.disabled = true;
        submitComplaintBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
      }

      try {
        const res = await fetch('/api/complaints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: category,
            subject: subject,
            message: message,
            student_name: studentName,
            grade_section: gradeSection,
            contact_info: contactInfo
          })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          complaintForm.reset();
          complaintForm.style.display = 'none';
          complaintSuccessState.style.display = 'block';
          if (ticketNumberDisplay) {
            ticketNumberDisplay.textContent = `#${data.ticket_id}`;
          }
        } else {
          if (complaintFormAlert) {
            complaintFormAlert.textContent = data.error || 'Failed to submit complaint. Please try again.';
            complaintFormAlert.style.display = 'block';
          }
        }
      } catch (err) {
        if (complaintFormAlert) {
          complaintFormAlert.textContent = 'Network error. Please check your connection and try again.';
          complaintFormAlert.style.display = 'block';
        }
      } finally {
        if (submitComplaintBtn) {
          submitComplaintBtn.disabled = false;
          submitComplaintBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Submit Complaint</span>';
        }
      }
    });
  }

  // ==========================================
  // Complaint Tracking & School Response Logic
  // ==========================================
  const tabSubmitBtn = document.getElementById('tabSubmitBtn');
  const tabTrackBtn = document.getElementById('tabTrackBtn');
  const submitView = document.getElementById('submitView');
  const trackView = document.getElementById('trackView');

  const trackForm = document.getElementById('trackForm');
  const trackTicketInput = document.getElementById('trackTicketInput');
  const btnTrackSubmit = document.getElementById('btnTrackSubmit');
  const trackAlert = document.getElementById('trackAlert');
  const trackResultView = document.getElementById('trackResultView');
  const trackResultTicket = document.getElementById('trackResultTicket');
  const trackResultCategory = document.getElementById('trackResultCategory');
  const trackResultStatus = document.getElementById('trackResultStatus');
  const trackResultDate = document.getElementById('trackResultDate');
  const trackResultSubject = document.getElementById('trackResultSubject');
  const trackResultMessage = document.getElementById('trackResultMessage');
  const trackResultAdminResponse = document.getElementById('trackResultAdminResponse');
  const schoolReplyContainer = document.getElementById('schoolReplyContainer');
  const btnTrackAnother = document.getElementById('btnTrackAnother');
  const trackNowFromSuccessBtn = document.getElementById('trackNowFromSuccessBtn');
  const sidebarTrackBtn = document.getElementById('sidebarTrackBtn');
  const topbarTrackBtn = document.getElementById('topbarTrackBtn');

  function switchToSubmitTab() {
    if (tabSubmitBtn) tabSubmitBtn.classList.add('active');
    if (tabTrackBtn) tabTrackBtn.classList.remove('active');
    if (submitView) submitView.style.display = 'block';
    if (trackView) trackView.style.display = 'none';
  }

  function switchToTrackTab(prefillTicket = '') {
    if (tabSubmitBtn) tabSubmitBtn.classList.remove('active');
    if (tabTrackBtn) tabTrackBtn.classList.add('active');
    if (submitView) submitView.style.display = 'none';
    if (trackView) trackView.style.display = 'block';
    if (trackAlert) trackAlert.style.display = 'none';

    if (prefillTicket && trackTicketInput) {
      trackTicketInput.value = prefillTicket;
      performTrack(prefillTicket);
    } else {
      if (trackResultView) trackResultView.style.display = 'none';
      if (trackForm) trackForm.style.display = 'block';
      if (trackTicketInput) trackTicketInput.focus();
    }
  }

  if (tabSubmitBtn) tabSubmitBtn.addEventListener('click', switchToSubmitTab);
  if (tabTrackBtn) tabTrackBtn.addEventListener('click', () => switchToTrackTab());

  if (sidebarTrackBtn) {
    sidebarTrackBtn.addEventListener('click', () => {
      openComplaintModal();
      switchToTrackTab();
    });
  }

  if (topbarTrackBtn) {
    topbarTrackBtn.addEventListener('click', () => {
      openComplaintModal();
      switchToTrackTab();
    });
  }

  if (trackNowFromSuccessBtn) {
    trackNowFromSuccessBtn.addEventListener('click', () => {
      const code = ticketNumberDisplay ? ticketNumberDisplay.textContent.replace('#', '') : '';
      switchToTrackTab(code);
    });
  }

  if (btnTrackAnother) {
    btnTrackAnother.addEventListener('click', () => {
      if (trackResultView) trackResultView.style.display = 'none';
      if (trackForm) trackForm.style.display = 'block';
      if (trackTicketInput) {
        trackTicketInput.value = '';
        trackTicketInput.focus();
      }
    });
  }

  if (trackForm) {
    trackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = trackTicketInput ? trackTicketInput.value.trim() : '';
      if (!code) return;
      performTrack(code);
    });
  }

  async function performTrack(ticketId) {
    if (!ticketId) return;
    if (btnTrackSubmit) {
      btnTrackSubmit.disabled = true;
      btnTrackSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
    }
    if (trackAlert) trackAlert.style.display = 'none';

    try {
      const res = await fetch('/api/complaints/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const c = data.complaint;
        if (trackResultTicket) trackResultTicket.textContent = `#${c.ticket_id}`;
        if (trackResultCategory) trackResultCategory.textContent = c.category;
        if (trackResultDate) trackResultDate.textContent = c.created_at;
        if (trackResultSubject) trackResultSubject.textContent = c.subject;
        if (trackResultMessage) trackResultMessage.textContent = c.message;

        if (trackResultStatus) {
          let statusClass = 'pending';
          let statusText = '⏳ Pending Review';
          if (c.status === 'Under Review') {
            statusClass = 'review';
            statusText = '🔍 Under Review by Leadership';
          } else if (c.status === 'Resolved') {
            statusClass = 'resolved';
            statusText = '✅ Resolved & Addressed';
          } else if (c.status === 'Dismissed') {
            statusClass = 'dismissed';
            statusText = '📁 Closed / Dismissed';
          }
          trackResultStatus.className = `status-pill ${statusClass}`;
          trackResultStatus.textContent = statusText;
        }

        if (trackResultAdminResponse && schoolReplyContainer) {
          if (c.admin_response && c.admin_response.trim()) {
            schoolReplyContainer.className = 'school-reply-container';
            trackResultAdminResponse.innerHTML = `<p>${escapeHtml(c.admin_response)}</p>`;
          } else {
            schoolReplyContainer.className = 'school-reply-container waiting';
            trackResultAdminResponse.innerHTML = `
              <div class="reply-waiting-text">
                <i class="fa-solid fa-hourglass-half"></i>
                <span>Your complaint has been received and is undergoing review by school leadership. The administration's response will appear here once evaluated. Please check back soon.</span>
              </div>
            `;
          }
        }

        if (trackForm) trackForm.style.display = 'none';
        if (trackResultView) trackResultView.style.display = 'block';
      } else {
        if (trackAlert) {
          trackAlert.textContent = data.error || 'No complaint found matching this code.';
          trackAlert.style.display = 'block';
        }
      }
    } catch (err) {
      if (trackAlert) {
        trackAlert.textContent = 'Network error while checking response. Please try again.';
        trackAlert.style.display = 'block';
      }
    } finally {
      if (btnTrackSubmit) {
        btnTrackSubmit.disabled = false;
        btnTrackSubmit.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> <span>Check Response</span>';
      }
    }
  }
});