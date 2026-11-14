// Local/development entrypoint. Vercel uses api/index.js instead.
import app from './app.js';
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3030);
app.listen(port, host, () => {
  console.log(`SherlyStudio local server: http://${host}:${port}`);
  console.log('Character Management + Admin AI Chat API ready.');
});
