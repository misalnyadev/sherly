// Vercel serverless entry. Routes /api/* to the shared Express app.
// Static files in public/ are served directly by Vercel's CDN.
import app from '../server/app.js';
export default app;
