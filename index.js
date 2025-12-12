// index.js (ESM) — verbose debug version
import 'dotenv/config';
import https from 'https';
import { GoogleGenAI } from '@google/genai';

console.log('starting debug script...');

if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set. Put it in .env or set it in your terminal.');
  process.exit(1);
}

// quick network sanity check (hit google)
function checkNetwork() {
  return new Promise((resolve) => {
    const req = https.request('https://www.google.com', { method: 'GET', timeout: 5000 }, (res) => {
      resolve({ ok: true, statusCode: res.statusCode });
    });
    req.on('error', (err) => resolve({ ok: false, err: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, err: 'timeout' });
    });
    req.end();
  });
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

try {
  (async () => {
    const net = await checkNetwork();
    console.log('network check:', net);

    console.log('sending request to model (60s timeout)...');
    const p = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'tell how i can crack placements',
    });

    // show that we created a promise
    console.log('promise created:', typeof p.then === 'function');

    // Wait up to 60s
    const timeoutMs = 60000;
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`timeout ${timeoutMs}ms`)), timeoutMs)
    );

    try {
      const response = await Promise.race([p, timeout]);
      console.log('\n=== got response ===');
      console.log(JSON.stringify(response, null, 2));
      // best-effort extract
      const text =
        response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        response?.text ||
        response?.outputs?.[0]?.content?.[0]?.text ||
        response?.candidates?.[0]?.text ||
        null;
      console.log('\n=== extracted text ===\n', text ?? '[no text found]');
    } catch (reqErr) {
      console.error('\nRequest failed or timed out. Error message:', reqErr && reqErr.message ? reqErr.message : reqErr);
      // If SDK attaches extra HTTP info, show it
      if (reqErr?.sdkHttpResponse) {
        console.error('sdkHttpResponse headers:', reqErr.sdkHttpResponse.headers || '[no headers present]');
        console.error('sdkHttpResponse statusCode:', reqErr.sdkHttpResponse.statusCode || '[no statusCode]');
      }
      // Also try awaiting the original promise with catch to show any rejection shape
      try {
        await p;
      } catch (pErr) {
        console.error('\nOriginal promise rejected with (full):');
        console.error(pErr);
        if (pErr?.sdkHttpResponse) {
          console.error('Original rejection sdkHttpResponse.headers:', pErr.sdkHttpResponse.headers);
        }
      }
    }
  })();
} catch (err) {
  console.error('Unexpected top-level error:', err);
}
