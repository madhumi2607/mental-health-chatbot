// index2.js
// Setup (one-time):
// npm install dotenv readline-sync @google/genai
// npm pkg set type=module   <-- only if package.json doesn't already have "type":"module"

import 'dotenv/config';
import readlineSync from 'readline-sync';
import { GoogleGenAI } from '@google/genai';

// single client instance
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// quick guard
if (!process.env.GOOGLE_API_KEY) {
  console.error('ERROR: set GOOGLE_API_KEY environment variable (add to .env or set in shell).');
  process.exit(1);
}

// ===== safety config =====
const CRISIS_KEYWORDS = [
  "kill myself", "kill me", "i want to die", "i'm going to kill myself",
  "suicide", "hang myself", "end my life", "i cant go on", "cant go on",
  "want to die", "harm myself", "self harm", "jump off", "i'll end it",
  "i will kill myself", "i'm going to hurt myself", "i want to hurt myself"
];

const CRISIS_REGEXES = [
  /i will .* myself/i,
  /i'm going to .* myself/i,
  /i wanna die/i,
  /want to die/i,
  /thinking about killing myself/i,
  /i have a (plan|means) to/i
];

const HELPLINES = [
  { name: "KIRAN (India mental health helpline)", number: "1800-599-0019" },
  { name: "TeleMANAS", number: "14416 / 1800-891-4416" },
  { name: "NIMHANS (Bengaluru)", number: "080-26995000" },
];

function detectCrisis(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  for (const kw of CRISIS_KEYWORDS) {
    if (t.includes(kw)) return true;
  }
  for (const rx of CRISIS_REGEXES) {
    if (rx.test(text)) return true;
  }
  return false;
}

function crisisResponseTemplate() {
  return [
    "I'm really sorry you're feeling this way — I want you to be safe.",
    "I can't provide emergency services, but I can share immediate help options and stay with you while you reach out.",
    "Please consider calling one of these helplines right now — trained people there can help immediately:",
  ].join(' ');
}

// ===== system prompt (keeps assistant in supportive role) =====
const SYSTEM_PROMPT = `
You are a compassionate, non-judgmental mental-health support assistant.
Strict rules to follow:
- Always be empathetic, calm, and respectful.
- Never be rude, sarcastic, or dismissive.
- Do NOT provide medical diagnoses or prescriptions.
- If user expresses suicidal ideation, self-harm intent, or immediate danger, STOP the conversation flow and immediately provide crisis resources and encourage contacting emergency services.
- Ask brief, gentle clarification questions only when helpful.
- Obtain explicit consent before storing or sharing any personal details.
- Keep replies concise (no more than 3 short paragraphs) and include at least one supportive statement each turn.
`.trim();

async function main() {
  // create chat (same shape as your original snippet)
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: [],
    config: {
      systemInstruction: SYSTEM_PROMPT,
    },
  });

  console.log("Mental-health checker (CLI). Type 'exit' to quit.\n");

  // ask for consent before starting
  const consent = readlineSync.question("Do you consent to use this supportive chatbot? (yes/no) ");
  if (!consent || consent.trim().toLowerCase() !== 'yes') {
    console.log("Consent not given. Exiting.");
    process.exit(0);
  }

  while (true) {
    const question = readlineSync.question("\nYou can share anything on your mind: ");
    if (!question) continue;

    const lowered = question.trim().toLowerCase();
    if (lowered === 'exit') {
      console.log("Goodbye — take care. If you're in immediate danger, contact local emergency services.");
      break;
    }

    // local crisis triage first
    if (detectCrisis(question)) {
      console.log("\n" + crisisResponseTemplate() + "\n");
      console.log("Immediate helplines:");
      for (const h of HELPLINES) {
        console.log(`• ${h.name}: ${h.number}`);
      }
      const stay = readlineSync.question("\nDo you want to continue and talk here? (yes/no) ");
      if (stay && stay.trim().toLowerCase() === 'yes') {
        console.log("Okay — I'm here. If at any point you feel unsafe, please call a helpline or emergency services.");
        continue;
      } else {
        console.log("I understand. Please reach out to someone you trust or the helplines if things feel overwhelming.");
        continue;
      }
    }

    // otherwise, send to model
    try {
      const response = await chat.sendMessage({ message: question });
      const replyText = response?.text ?? response?.message?.content?.[0]?.text ?? JSON.stringify(response);
      console.log("\nResponse:", replyText);
    } catch (err) {
      console.error("Error calling model:", err);
      console.log("Try again later or contact local support if you need urgent help.");
    }
  }
}

await main();
