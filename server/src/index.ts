import 'dotenv/config';
import { startBot } from './bot/index.js';
import { startApi } from './api/index.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  console.log('🚀 Starting Glass Quizzes Server...');
  
  // Start the API server
  await startApi(PORT);
  
  // Start the Telegram bot
  await startBot();
  
  console.log(`✅ Server running on port ${PORT}`);
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
