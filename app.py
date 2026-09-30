import os
import re
import sqlite3
import random
import csv
import io
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session, redirect, url_for, Response
from flask_cors import CORS
from dotenv import load_dotenv

# Search and load .env from current directory first, or from python project
load_dotenv()
if not os.getenv("GROQ") and not os.getenv("GROQ_API_KEY"):
    load_dotenv(r"c:\Users\rjik\python project\.env")

app = Flask(__name__)
CORS(app)

# Secret key for admin session management
app.secret_key = os.getenv("SECRET_KEY", "astu_special_school_2026_complaint_key_xyz987")

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "complaints.db")
ADMIN_CODE = os.getenv("ADMIN_CODE", "astu ss2026").strip().lower()

# ==============================================================================
# Database Initialization & Helpers
# ==============================================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    try:
        with get_db() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS complaints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id TEXT UNIQUE NOT NULL,
                    created_at TEXT NOT NULL,
                    student_name TEXT,
                    grade_section TEXT,
                    contact_info TEXT,
                    category TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    message TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'Pending',
                    admin_notes TEXT DEFAULT ''
                );
            """)
            conn.commit()
    except Exception as e:
        print(f"Error initializing complaints database: {e}")

# Initialize database
init_db()

# ==============================================================================
# Knowledge Base & Prompts
# ==============================================================================
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
ASTU Special School is a non-boarding secondary school.

Student Complaints & Feedback:
Students can submit complaints, issues, or suggestions through the school's official Complaint & Feedback Portal (accessible via the Report/Complaint button or directly at /admin for school leaders). Submissions can be anonymous. The school administration receives and reviews all student feedback in the secure Admin Portal."""

SYSTEM_PROMPT = f"""You are a friendly, welcoming, and interactive AI chatbot for ASTU Special School.

Personality and Behavior:
- Always be warm, polite, and engaging with visitors.
- When someone introduces themselves (for example, saying 'my name is Imran' or 'I am Sarah'), warmly greet them: 'Oh, welcome Imran! How are you doing today? How can I assist you regarding ASTU Special School?', and remember their name in the ongoing conversation.
- When someone asks how you are, respond politely and ask how you can help them with ASTU Special School.
- If a user asks about submitting a complaint, reporting a problem, or giving feedback, let them know that ASTU Special School has a direct student complaint portal where they can submit complaints (anonymously if desired), and school administrators review them in the Admin Portal.
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
    {"role": "assistant", "content": "You can contact ASTU Special School through the following channels:\n- School phone: 022 211 8846\n- Email: astuss@gmail.com\n- Location: Adama, Ethiopia\n- Telegram: @ASTU_SPS"},
    {"role": "user", "content": "how can I submit a complaint or suggestion to the school?"},
    {"role": "assistant", "content": "You can easily submit a complaint or suggestion directly to the school administration using our **Complaint & Feedback Portal**! Simply click the **'Complaint / Report'** button at the top or in the sidebar. You can choose to submit it anonymously or provide your details. School administrators receive and review all feedback in the Admin Portal."}
]

def get_api_key():
    key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ") or os.getenv("GROQ_KEY")
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
        return "👋 **Hello! Welcome to ASTU Special School AI Assistant.**\n\nHow are you doing today? I can help you with questions about our school campus, leadership, contacts, complaint submissions, or academic programs."

    # 'How are you'
    if "how are you" in q:
        return "I'm doing great, thank you for asking! How are you doing today? How can I assist you regarding ASTU Special School?"

    # Complaint and suggestions inquiry
    if any(term in q for term in ["complaint", "complain", "feedback", "suggestion", "report an issue", "report a problem", "admin portal"]):
        return (
            "📝 **ASTU Special School Complaint & Feedback System**\n\n"
            "Students can submit complaints, issues, or suggestions directly to school administration:\n\n"
            "- **Submit Feedback / Complaint**: Click the **'Complaint / Report'** button in the top navigation or sidebar.\n"
            "- **Anonymous Option**: You can submit your message anonymously or include your name and grade.\n"
            "- **Direct to Administration**: The school leadership receives and reviews submissions through the secure **Admin Portal**."
        )

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

# ==============================================================================
# Public Chat & Health Routes
# ==============================================================================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health", methods=["GET"])
def health():
    key = get_api_key()
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    masked_key = f"{key[:7]}...{key[-4:]} (len: {len(key)})" if key else "NOT_CONFIGURED"
    return jsonify({
        "status": "online",
        "school": "ASTU Special School",
        "model": model,
        "api_key_configured": bool(key),
        "key_preview": masked_key
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
        print(f"Groq error occurred: {err_msg}")
        fallback_answer = answer_from_verified_kb(user_message)
        return jsonify({
            "reply": fallback_answer,
            "mode": "fallback_kb",
            "error_detail": err_msg
        })

# ==============================================================================
# Student Complaints Submission API
# ==============================================================================
@app.route("/api/complaints", methods=["POST"])
def submit_complaint():
    data = request.get_json() or {}
    category = data.get("category", "").strip()
    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()
    student_name = data.get("student_name", "").strip() or "Anonymous"
    grade_section = data.get("grade_section", "").strip()
    contact_info = data.get("contact_info", "").strip()

    if not category:
        return jsonify({"error": "Please select a category for your complaint."}), 400
    if not subject:
        return jsonify({"error": "Please provide a subject line."}), 400
    if not message:
        return jsonify({"error": "Please provide the complaint details."}), 400

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    random_suffix = random.randint(1000, 9999)
    ticket_id = f"ASTU-{random_suffix}"

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            # Ensure unique ticket id
            cursor.execute("SELECT id FROM complaints WHERE ticket_id = ?", (ticket_id,))
            while cursor.fetchone():
                random_suffix = random.randint(1000, 9999)
                ticket_id = f"ASTU-{random_suffix}"

            cursor.execute("""
                INSERT INTO complaints (ticket_id, created_at, student_name, grade_section, contact_info, category, subject, message, status, admin_notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', '')
            """, (ticket_id, now, student_name, grade_section, contact_info, category, subject, message))
            conn.commit()

        return jsonify({
            "success": True,
            "ticket_id": ticket_id,
            "message": "Complaint submitted successfully! School administration will review your submission."
        }), 201
    except Exception as e:
        print(f"Error saving complaint: {e}")
        return jsonify({"error": f"Failed to save complaint: {str(e)}"}), 500

# ==============================================================================
# Admin Portal & Authentication
# ==============================================================================
@app.route("/admin")
def admin_page():
    is_authenticated = session.get("is_admin") is True
    return render_template("admin.html", authenticated=is_authenticated)

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}
    code = data.get("code", "").strip().lower()

    if code == ADMIN_CODE:
        session["is_admin"] = True
        return jsonify({
            "success": True,
            "message": "Admin authorization successful."
        })
    else:
        return jsonify({
            "success": False,
            "error": "Invalid admin access code. Please check your passcode and try again."
        }), 401

@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("is_admin", None)
    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    })

@app.route("/api/admin/complaints", methods=["GET"])
def get_admin_complaints():
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized. Admin authentication required."}), 401

    status_filter = request.args.get("status", "").strip()
    category_filter = request.args.get("category", "").strip()
    search_query = request.args.get("q", "").strip().lower()

    query = "SELECT * FROM complaints WHERE 1=1"
    params = []

    if status_filter and status_filter.lower() != "all":
        query += " AND LOWER(status) = ?"
        params.append(status_filter.lower())

    if category_filter and category_filter.lower() != "all":
        query += " AND LOWER(category) = ?"
        params.append(category_filter.lower())

    query += " ORDER BY id DESC"

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            complaints = [dict(row) for row in rows]

            # In-memory search filter for multi-field coverage
            if search_query:
                complaints = [
                    c for c in complaints
                    if search_query in c["ticket_id"].lower()
                    or search_query in c["subject"].lower()
                    or search_query in c["message"].lower()
                    or search_query in (c["student_name"] or "").lower()
                    or search_query in (c["grade_section"] or "").lower()
                    or search_query in (c["contact_info"] or "").lower()
                ]

            # Overall stats
            cursor.execute("SELECT status, COUNT(*) as count FROM complaints GROUP BY status")
            status_counts = cursor.fetchall()
            stats = {"total": 0, "Pending": 0, "Under Review": 0, "Resolved": 0, "Dismissed": 0}
            total = 0
            for sc in status_counts:
                s = sc["status"]
                c = sc["count"]
                total += c
                stats[s] = c
            stats["total"] = total

        return jsonify({
            "success": True,
            "complaints": complaints,
            "stats": stats
        })
    except Exception as e:
        print(f"Error fetching complaints: {e}")
        return jsonify({"error": f"Failed to retrieve complaints: {str(e)}"}), 500

@app.route("/api/admin/complaints/<ticket_id>/update", methods=["POST"])
def update_admin_complaint(ticket_id):
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    new_status = data.get("status")
    admin_notes = data.get("admin_notes")

    if not new_status and admin_notes is None:
        return jsonify({"error": "Nothing to update."}), 400

    updates = []
    params = []
    if new_status:
        updates.append("status = ?")
        params.append(new_status)
    if admin_notes is not None:
        updates.append("admin_notes = ?")
        params.append(admin_notes)

    params.append(ticket_id)

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE complaints SET {', '.join(updates)} WHERE ticket_id = ?", params)
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Complaint not found."}), 404

        return jsonify({"success": True, "message": f"Complaint {ticket_id} updated successfully."})
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/api/admin/complaints/<ticket_id>", methods=["DELETE"])
def delete_admin_complaint(ticket_id):
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM complaints WHERE ticket_id = ?", (ticket_id,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Complaint not found."}), 404

        return jsonify({"success": True, "message": f"Complaint {ticket_id} deleted successfully."})
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route("/api/admin/export", methods=["GET"])
def export_complaints():
    if not session.get("is_admin"):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT ticket_id, created_at, student_name, grade_section, contact_info, category, subject, message, status, admin_notes FROM complaints ORDER BY id DESC")
            rows = cursor.fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Ticket ID", "Date Submitted", "Student Name", "Grade & Section", "Contact Info", "Category", "Subject", "Complaint Details", "Status", "Admin Notes"])
        for row in rows:
            writer.writerow(list(row))

        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename=ASTU_Special_School_Complaints_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )
    except Exception as e:
        return jsonify({"error": f"Export error: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    print("=" * 60)
    print("ASTU Special School AI Assistant & Admin Portal")
    print(f"Chatbot running at:     http://localhost:{port}")
    print(f"Admin Portal running at: http://localhost:{port}/admin")
    print(f"Admin Passcode:         astu ss2026")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
