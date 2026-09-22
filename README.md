# ASTU Special School - AI Assistant Web Application

A modern, responsive full-stack AI chatbot for **ASTU Special School** (Adama Science and Technology University Special School, Adama, Ethiopia), powered by **Groq High-Speed AI** and **Flask**.

---

## 🌟 Features

- **Campus Showcase**: Features the ASTU Special School building photograph with location tags and leadership directory.
- **ChatGPT-Style Chat**: High-speed conversational AI with typing indicators, markdown formatting, and quick question suggestion chips.
- **Verified Knowledge Base**: Answers questions about academic programs, leadership (Director Mr. Garedew Jima, Vice Director Mr. Mekonen Kebede), contact channels, and non-boarding school structure.
- **Direct Telegram Fallback**: Integrates developer contacts (`@GTRXBomerance` and `@Fear_NF`) so users can submit missing info directly.
- **Responsive Layout**: Seamless on mobile phones, tablets, and desktop displays.
- **Ready for Deployment**: Includes `Procfile` and `requirements.txt` for 1-click cloud deployment.

---

## 🚀 Quick Start (Running Locally)

### 1. Open the project folder
```bash
cd C:\Users\rjik\.gemini\antigravity\scratch\astu-special-school-bot
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set your Groq API Key
Create a `.env` file in the project directory (or copy `.env.example` to `.env`):
```env
GROQ=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=5000
```
> *Tip: You can generate a free Groq API key at [console.groq.com/keys](https://console.groq.com/keys).*

### 4. Start the Application
```bash
python app.py
```
Open your browser and navigate to:
```
http://localhost:5000
```

---

## 🌐 How to Publish Online for Free (On Google / Web)

You can publish this website live to the world in less than 5 minutes using **Render** (100% Free):

1. **Push your code to GitHub**:
   - Create a free account on [GitHub.com](https://github.com)
   - Create a new repository (e.g., `astu-school-bot`)
   - Push your project files to the repository.

2. **Deploy on Render**:
   - Go to [render.com](https://render.com) and sign up for free.
   - Click **New +** -> **Web Service**.
   - Connect your GitHub repository.
   - Set the settings:
     - **Name**: `astu-special-school`
     - **Environment**: `Python 3`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn app:app`
   - Scroll down to **Environment Variables** and add:
     - Key: `GROQ`
     - Value: `gsk_your_groq_api_key_here`
   - Click **Create Web Service**.

Render will deploy your site and provide a public URL (e.g., `https://astu-special-school.onrender.com`) that anyone in the world can visit!

---

## 👥 Credits & Contacts

- **School**: ASTU Special School, Adama, Ethiopia
- **Director**: Mr. Garedew Jima
- **Vice Director**: Mr. Mekonen Kebede
- **Developers**: Telegram: [@GTRXBomerance](https://t.me/GTRXBomerance) & [@Fear_NF](https://t.me/Fear_NF)
