// backend/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Initialize Google AI
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

if (!process.env.GOOGLE_API_KEY) {
  console.error('ERROR: GOOGLE_API_KEY not set in .env file');
  process.exit(1);
}

// Enhanced System prompt with better empathy and actionable advice
const SYSTEM_PROMPT = `
You are a warm, understanding mental health support companion. Your role is to provide genuine empathy, validation, and practical coping strategies.

Core Principles:
1. LISTEN DEEPLY: Acknowledge the person's feelings without minimizing them. Use phrases like "That sounds really difficult" or "It makes sense you'd feel that way given what you're going through."

2. VALIDATE EMOTIONS: Never say "it's okay" or "don't worry" - these dismiss feelings. Instead, normalize their experience: "Many people feel overwhelmed in situations like this" or "Your reaction is completely understandable."

3. PROVIDE PRACTICAL TOOLS: After validating, offer 2-3 specific, actionable coping strategies tailored to their situation:
   - For anxiety: breathing exercises (4-7-8 technique), grounding (5-4-3-2-1 method), progressive muscle relaxation
   - For sadness/depression: small achievable tasks, connecting with one person, gentle movement, sunlight exposure
   - For stress: breaking tasks into tiny steps, setting boundaries, self-compassion breaks
   - For anger: physical release (exercise, squeezing ice), journaling, timeout strategies
   - For loneliness: reaching out to one person, joining online communities, volunteering
   - For overwhelm: priority triaging, "one thing at a time" approach, asking for help

4. ASK THOUGHTFUL QUESTIONS: Help them explore solutions:
   - "What's helped you cope with similar feelings before?"
   - "What would make today 1% easier?"
   - "Who in your life might understand what you're going through?"
   - "What's one small thing you could do right now to take care of yourself?"

5. ENCOURAGE PROFESSIONAL SUPPORT: When appropriate, gently suggest therapy, counseling, or speaking with a doctor - frame it as a strength, not a failure.

6. BE CONCISE BUT WARM: Keep responses to 2-3 paragraphs. Use a conversational, caring tone - like a supportive friend who happens to know evidence-based strategies.

What NOT to do:
- Don't say "everything will be fine" or "it's okay" - this invalidates their current pain
- Don't give medical diagnoses or prescribe medication
- Don't be overly formal or clinical
- Don't overwhelm with too many suggestions at once
- Don't minimize their struggles by comparing to others

Remember: You're here to support, not fix. Sometimes people just need to feel heard and receive one helpful strategy they can try today.
`.trim();

// Store chat sessions (in production, use proper session management)
const chatSessions = new Map();

// Enhanced crisis detection with more phrases
const CRISIS_KEYWORDS = [
  "kill myself", "kill me", "i want to die", "i'm going to kill myself",
  "suicide", "suicidal", "hang myself", "end my life", "i cant go on", "cant go on",
  "want to die", "harm myself", "self harm", "cut myself", "hurt myself",
  "jump off", "i'll end it", "i will kill myself", "i'm going to hurt myself",
  "i want to hurt myself", "overdose", "no reason to live", "better off dead",
  "can't take it anymore", "everyone would be better without me"
];

function detectCrisis(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  
  // Check for explicit crisis keywords
  const hasCrisisKeyword = CRISIS_KEYWORDS.some(keyword => t.includes(keyword));
  
  // Check for concerning patterns
  const concerningPatterns = [
    /(?:don'?t|do not) want to (?:live|be here|exist)/i,
    /(?:ready|want|going) to (?:end|give up)/i,
    /no (?:point|reason) (?:in|to) (?:living|going on)/i
  ];
  
  const hasPattern = concerningPatterns.some(pattern => pattern.test(text));
  
  return hasCrisisKeyword || hasPattern;
}

// Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check for crisis keywords
    if (detectCrisis(message)) {
      return res.json({
        reply: `I hear that you're in a lot of pain right now, and I'm really concerned about your safety. Please reach out to one of these resources immediately - they have trained counselors available 24/7 who can provide the support you need:

**If you're in immediate danger, please call emergency services (911 in US) or go to your nearest emergency room.**

**Crisis Helplines:**
- National Suicide Prevention Lifeline: 988 (US)
- Crisis Text Line: Text HOME to 741741 (US)
- International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/

You don't have to face this alone. These feelings can be overwhelming, but help is available and things can get better.`,
        isCrisis: true
      });
    }

    // Get or create chat session
    let chat = chatSessions.get(sessionId);
    if (!chat) {
      chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: [],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.8, // Slightly more warmth and variation
          topP: 0.95,
        },
      });
      chatSessions.set(sessionId, chat);
    }

    // Send message to AI
    const response = await chat.sendMessage({ message });
    const replyText = response?.text ?? response?.message?.content?.[0]?.text ?? 
      "I'm here and I'm listening. Could you tell me a bit more about what you're experiencing right now?";

    res.json({ 
      reply: replyText,
      isCrisis: false
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'An error occurred. Please try again.',
      reply: "I apologize, but I'm having trouble responding right now. If you're in distress and need immediate support, please reach out to a crisis helpline or mental health professional. I'll be here when you're ready to try again."
    });
  }
});

// Clear session endpoint (useful for starting fresh)
app.post('/api/clear-session', (req, res) => {
  const { sessionId = 'default' } = req.body;
  chatSessions.delete(sessionId);
  res.json({ success: true, message: 'Session cleared' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeSessions: chatSessions.size });
});

app.listen(PORT, () => {
  console.log(`🌟 Mental Health Support Server running on http://localhost:${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} in your browser`);
  console.log(`💚 Ready to provide empathetic support`);
});