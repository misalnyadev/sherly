// Vercel serverless entry. Routes /api/* to the shared Express app.
// Static files in public/ are served directly by Vercel's CDN.
import app from '../server/app.js';
export default app;
// Generate gambar (board img2img Kie/Gemini, TTS) bisa makan >10 detik.
export const maxDuration = 60;
