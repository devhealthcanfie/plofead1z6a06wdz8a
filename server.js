// server.js - No HTTP server, just bot
console.log('🎮 Starting Minecraft AFK Bot...');
require('./bot.js');

// Keep process alive
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
