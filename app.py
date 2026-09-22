import os
import re
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

# Search and load .env from current directory first, or from python project
load_dotenv()
if not os.getenv("GROQ") and not os.getenv("GROQ_API_KEY"):
    load_dotenv(r"c:\Users\rjik\python project\.env")

app = Flask(__name__)
CORS(app)

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")

INFO = """ASTU Special School

Location:
Adama, Ethiopia

About the school:
ASTU Special School is a secondary school located in Adama, 
Ethiopia, established under the umbrella of Adama Science and Technology University (ASTU).

The school focuses on academic excellence and provides a 
competitive learning environment for talented students. Students have opportunities to learn from one another, 
exchange knowledge, collaborate, and develop academically.

The school promotes:
- Academic excellence
- Science and technology education
- Critical thinking
- Problem solving
- Collaboration
- Discipline
- Healthy academic competition
- Student development

Leadership:
- Director: Mr. Garedew Jima
- Vice Director: Mr. Mekonen Kebede

Contact:
- School phone: 022 211 8846
- Email: astuss@gmail.com
- Location: Adama, Ethiopia
- Telegram: @ASTU_SPS

School type:
ASTU Special School is a non-boarding secondary school."""

SYSTEM_PROMPT = f"""You are a friendly, welcoming, and interactive AI chatbot for ASTU Special School.

Personality and Behavior:
- Always be warm, polite, and engaging with visitors.
- When someone introduces themselves (for example, saying 'my name is Imran' or 'I am Sarah'), warmly greet them: 'Oh, welcome Imran! How are you doing today? How can I assist you regarding ASTU Special School?', and remember their name in the ongoing conversation.
- When someone asks how you are, respond politely and ask how you can help them with ASTU Special School.
- For factual questions about ASTU Special School (location, directors, contact, programs, boarding), answer accurately based on the verified information below:
```{INFO}```

Missing Information Guideline:
- If a user asks for specific institutional ASTU Special School facts that are NOT in the verified records above (such as tuition fees, specific uniform colors, or clubs not listed), clearly and politely explain that you do not currently have that school information in your records rather than inventing an answer, and provide the developer Telegram contacts (@GTRXBomerance or @Fear_NF) so they can request it to be added.
- NEVER give the 'missing information' or developer contact message for friendly greetings, casual small talk, or personal introductions! Always respond to greetings warmly and interactively."""

FEW_SHOT_MESSAGES = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": "my name is imran"},
    {"role": "assistant", "content": "Oh, welcome Imran! How are you doing today? How can I assist you regarding ASTU Special School?"},
    {"role": "user", "content": "where does astu special school located"},
    {"role": "assistant", "content": "ASTU Special School is a secondary school located in Adama, Ethiopia, established under the umbrella of Adama Science and Technology University (ASTU)."},
    {"role": "user", "content": "who is the director of astu special school"},
    {"role": "assistant", "content": "ASTU Special School director is Mr. Garedew Jima, and the Vice Director is Mr. Mekonen Kebede."},
    {"role": "user", "content": "how can i contact astu special school"},
    {"role": "assistant", "content": "You can contact ASTU Special School through the following channels:\n- School phone: 022 211 8846\n- Email: astuss@gmail.com\n- Location: Adama, Ethiopia\n- Telegram: @ASTU_SPS"}
]

def get_api_key():
    key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ")
    if key:
        clean_key = key.strip('\'" \\t\\r\\n')
        if not clean_key.startswith("gsk_your_groq") and len(clean_key) > 10:
            return clean_key
    return None

def get_groq_client():
    api_key = get_api_key()
    if not api_key:
        return None
    try:
        from groq import Groq
        return Groq(api_key=api_key)
    except Exception as e:
        print(f"Error initializing Groq: {e}")
        return None

def answer_from_verified_kb(question: str):
    """
    Offline fallback responder if Groq network is unreachable.
    Always maintains friendly, interactive personality and answers verified facts.
    """
    q = question.lower().strip()

    # Friendly Introduction / Name detection (e.g. 'my name is Imran', 'I am Imran')
    name_match = re.search(r"(?:my name is|i am|i'm|call me)\s+([A-Za-z]+)", q, re.IGNORECASE)
    if name_match:
        name = name_match.group(1).capitalize()
        return f"Oh, welcome {name}! How are you doing today? How can I assist you regarding ASTU Special School?"

    # Name inquiry
    if any(term in q for term in ["what is my name", "what's my name", "who am i", "remember my name"]):
        return "You haven't told me your name yet! What should I call you?"

    # Friendly greeting
    if any(term in q for term in ["hello", "hi", "hey", "selam", "greetings", "good morning", "good afternoon"]):
        return "👋 **Hello! Welcome to ASTU Special School AI Assistant.**\n\nHow are you doing today? I can help you with questions about our school campus, leadership, contacts, or academic programs."

    # 'How are you'
    if "how are you" in q:
        return "I'm doing great, thank you for asking! How are you doing today? How can I assist you regarding ASTU Special School?"

    # Location query
    if any(term in q for term in ["location", "located", "where is", "where does", "where's", "place", "city", "adama", "ethiopia"]):
        return (
            "📍 **Location of ASTU Special School**\n\n"
            "ASTU Special School is a secondary school located in **Adama, Ethiopia**, "
            "established under the umbrella of **Adama Science and Technology University (ASTU)**."
        )

    # Leadership query
    if any(term in q for term in ["director", "vice director", "principal", "head", "leader", "garedew", "jima", "mekonen", "kebede"]):
        return (
            "👨‍🏫 **School Leadership**\n\n"
            "The administration of ASTU Special School is led by:\n"
            "- **Director**: Mr. Garedew Jima\n"
            "- **Vice Director**: Mr. Mekonen Kebede"
        )

    # Contact query
    if any(term in q for term in ["contact", "phone", "email", "call", "reach", "telegram", "channel", "number", "tel"]):
        return (
            "📞 **Contact Information**\n\n"
            "You can contact ASTU Special School through the following verified channels:\n"
            "- **School Phone**: 022 211 8846\n"
            "- **Email**: astuss@gmail.com\n"
            "- **Location**: Adama, Ethiopia\n"
            "- **Official Telegram**: @ASTU_SPS"
        )

    # Boarding status
    if any(term in q for term in ["boarding", "board", "dorm", "hostel", "live", "stay"]):
        return (
            "🏫 **School Type**\n\n"
            "ASTU Special School is a **non-boarding** secondary school."
        )

    # Promotion / Focus / About
    if any(term in q for term in ["promote", "focus", "values", "about the school", "mission", "curriculum", "excellence", "science", "collaboration", "what does the school", "what is astu"]):
        return (
            "🎯 **About ASTU Special School**\n\n"
            "ASTU Special School is a secondary school in Adama, Ethiopia under ASTU that focuses on "
            "academic excellence and provides a competitive learning environment for talented students.\n\n"
            "**The school promotes:**\n"
            "- Academic excellence\n"
            "- Science and technology education\n"
            "- Critical thinking & Problem solving\n"
            "- Collaboration & Discipline\n"
            "- Healthy academic competition\n"
            "- Student development"
        )

    # Fallback for unlisted school inquiries
    return (
        "I do not currently have that specific information in my verified ASTU Special School records.\n\n"
        "Please contact the school developers on Telegram so they can verify and add it:\n"
        "- @GTRXBomerance\n"
        "- @Fear_NF"
    )

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health", methods=["GET"])
def health():
    key = get_api_key()
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    return jsonify({
        "status": "online",
        "school": "ASTU Special School",
        "model": model,
        "api_key_configured": bool(key)
    })

@app.route("/api/settings/key", methods=["POST"])
def save_api_key():
    data = request.get_json() or {}
    key = data.get("api_key", "").strip()

    if not key:
        return jsonify({"error": "API Key cannot be empty."}), 400

    if not key.startswith("gsk_") or len(key) < 15:
        return jsonify({"error": "Invalid Groq API key format. A valid Groq key starts with 'gsk_'."}), 400

    os.environ["GROQ_API_KEY"] = key
    os.environ["GROQ"] = key

    try:
        new_lines = []
        key_written = False
        if os.path.exists(ENV_PATH):
            with open(ENV_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
            for line in lines:
                if line.startswith("GROQ_API_KEY=") or line.startswith("GROQ="):
                    if not key_written:
                        new_lines.append(f"GROQ_API_KEY={key}\n")
                        key_written = True
                else:
                    new_lines.append(line)
        if not key_written:
            new_lines.append(f"GROQ_API_KEY={key}\n")

        with open(ENV_PATH, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as e:
        print(f"Warning: could not write to .env: {e}")

    return jsonify({
        "success": True,
        "message": "Groq API key saved successfully! High-speed AI is now active."
    })

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    user_message = data.get("message", "").strip()
    history = data.get("history", [])

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    client = get_groq_client()

    # If Groq is not configured, fall back to intelligent offline responder
    if client is None:
        answer = answer_from_verified_kb(user_message)
        return jsonify({
            "reply": answer,
            "mode": "verified_kb"
        })

    # Prepare complete prompt including system prompt, few-shots, and conversation history
    messages_payload = list(FEW_SHOT_MESSAGES)

    # Pass ongoing conversation history for memory and context
    if isinstance(history, list):
        for msg in history[-10:]:
            role = msg.get("role")
            content = msg.get("content")
            if role in ["user", "assistant"] and content:
                messages_payload.append({"role": role, "content": content})

    # Current user message
    messages_payload.append({"role": "user", "content": user_message})

    # Use user's model openai/gpt-oss-120b
    model_name = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=messages_payload,
            temperature=0.8
        )
        reply = response.choices[0].message.content
        return jsonify({"reply": reply, "mode": "groq_ai"})
    except Exception as e:
        err_msg = str(e)
        # Fallback to fast model if model name fails
        if "model_not_found" in err_msg.lower() and model_name != "llama-3.3-70b-versatile":
            try:
                response = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages_payload,
                    temperature=0.8
                )
                return jsonify({"reply": response.choices[0].message.content, "mode": "groq_ai"})
            except Exception:
                pass

        # If cloud call fails, use the verified knowledge base
        fallback_answer = answer_from_verified_kb(user_message)
        return jsonify({
            "reply": fallback_answer,
            "mode": "fallback_kb"
        })

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    print("=" * 60)
    print("ASTU Special School AI Assistant Web Server")
    print(f"Server running at: http://localhost:{port}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
