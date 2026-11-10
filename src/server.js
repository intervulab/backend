import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';

async function startServer() {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT} in [${env.NODE_ENV}] mode`);
  });
}

startServer();