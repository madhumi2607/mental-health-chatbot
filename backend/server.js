// backend/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve frontend static files from ../frontend
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');

// Middleware
app.use(cors()); // tighten in prod with origin option
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

// Validate API key early
if (!process.env.GOOGLE_API_KEY) {
  console.error('ERROR: GOOGLE_API_KEY not set. Create a .env with GOOGLE_API_KEY=your_key');
  process.exit(1);
}

// Initialize Google GenAI
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// System prompt (your empathetic assistant)
const SYSTEM_PROMPT = `
You are a warm, understanding mental health support companion. Your role is to provide genuine empathy, validation, and practical coping strategies. Core Principles: 1. LISTEN DEEPLY: Acknowledge the person's feelings without minimizing them. Use phrases like "That sounds really difficult" or "It makes sense you'd feel that way given what you're going through." 2. VALIDATE EMOTIONS: Never say "it's okay" or "don't worry" - these dismiss feelings. Instead, normalize their experience: "Many people feel overwhelmed in situations like this" or "Your reaction is completely understandable." 3. PROVIDE PRACTICAL TOOLS: After validating, offer 2-3 specific, actionable coping strategies tailored to their situation: - For anxiety: breathing exercises (4-7-8 technique), grounding (5-4-3-2-1 method), progressive muscle relaxation - For sadness/depression: small achievable tasks, connecting with one person, gentle movement, sunlight exposure - For stress: breaking tasks into tiny steps, setting boundaries, self-compassion breaks - For anger: physical release (exercise, squeezing ice), journaling, timeout strategies - For loneliness: reaching out to one person, joining online communities, volunteering - For overwhelm: priority triaging, "one thing at a time" approach, asking for help 4. ASK THOUGHTFUL QUESTIONS: Help them explore solutions: - "What's helped you cope with similar feelings before?" - "What would make today 1% easier?" - "Who in your life might understand what you're going through?" - "What's one small thing you could do right now to take care of yourself?" 5. ENCOURAGE PROFESSIONAL SUPPORT: When appropriate, gently suggest therapy, counseling, or speaking with a doctor - frame it as a strength, not a failure. 6. BE CONCISE BUT WARM: Keep responses to 2-3 paragraphs. Use a conversational, caring tone - like a supportive friend who happens to know evidence-based strategies. What NOT to do: - Don't say "everything will be fine" or "it's okay" - this invalidates their current pain - Don't give medical diagnoses or prescribe medication - Don't be overly formal or clinical - Don't overwhelm with too many suggestions at once - Don't minimize their struggles by comparing to others Remember: You're here to support, not fix. Sometimes people just need to feel heard and receive one helpful strategy they can try today.
`.trim();

// In-memory sessions (okay for dev; use DB/Redis in prod)
const chatSessions = new Map();

// Crisis detection list
const CRISIS_KEYWORDS = [
  "kill myself","kill me","i want to die","i'm going to kill myself","suicide","suicidal",
  "hang myself","end my life","i cant go on","cant go on","want to die","harm myself",
  "self harm","cut myself","hurt myself","jump off","i'll end it","i will kill myself",
  "overdose","no reason to live","better off dead","can't take it anymore"
];

function detectCrisis(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  if (CRISIS_KEYWORDS.some(k => t.includes(k))) return true;
  const patterns = [
    /(?:don'?t|do not) want to (?:live|be here|exist)/i,
    /(?:ready|want|going) to (?:end|give up)/i,
    /no (?:point|reason) (?:in|to) (?:living|going on)/i
  ];
  return patterns.some(p => p.test(text));
}

// Create or reuse chat
function getOrCreateChat(sessionId = 'default') {
  let chat = chatSessions.get(sessionId);
  if (!chat) {
    chat = ai.chats.create({
      model: 'models/gemini-2.5-flash',
      history: [],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
        topP: 0.95,
      },
    });
    chatSessions.set(sessionId, chat);
  }
  return chat;
}

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Crisis handling (immediate static response)
    if (detectCrisis(message)) {
      return res.status(200).json({
        isCrisis: true,
        reply: `I'm really sorry you're feeling so bad right now. If you're in immediate danger, please call emergency services. Here are some helplines:
- KIRAN (India): 1800-599-0019
- TeleMANAS: 14416 / 1800-891-4416
- NIMHANS (Bengaluru): 080-26995000

If you can, please reach out to someone near you or contact local emergency services.`,
      });
    }

    // Normal flow: create/get session and send to model
    const chat = getOrCreateChat(sessionId);
    const response = await chat.sendMessage({ message });

    const replyText =
      response?.text ??
      (Array.isArray(response?.message?.content) && response.message.content[0]?.text) ??
      "Thanks for sharing — can you tell me a little more about what this feels like?";

    return res.json({ isCrisis: false, reply: replyText });
  } catch (err) {
    console.error('Server error:', err);
    const status = err?.status || 500;
    return res.status(status).json({
      error: 'Server error',
      detail: err?.message ?? String(err),
      reply: "Sorry — I'm having trouble right now. If you're in danger, contact local emergency services."
    });
  }
});

// Clear session (optional)
app.post('/api/clear-session', (req, res) => {
  const { sessionId = 'default' } = req.body || {};
  chatSessions.delete(sessionId);
  res.json({ success: true });
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeSessions: chatSessions.size });
});

// Serve index.html for root if present
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}  (serving frontend from ${FRONTEND_DIR})`);
});
