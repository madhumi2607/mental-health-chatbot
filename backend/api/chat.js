import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // allow Netlify origin (or '*' for testing)
  res.setHeader('Access-Control-Allow-Origin', 'https://supportsystemforme.netlify.app'); 
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ...existing code...
}


const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const chat = ai.chats.create({
      model: "models/gemini-2.5-flash",
      history: [],
    });

    const reply = await chat.sendMessage({ message });
    res.status(200).json({ text: reply.text });

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Server error", detail: error.message });
  }
}
