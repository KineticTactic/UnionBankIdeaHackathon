require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  demoServerUrl: process.env.DEMO_SERVER_URL || 'http://localhost:3001',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
  useClaudeFallback: process.env.USE_CLAUDE_FALLBACK === 'true' || !process.env.ANTHROPIC_API_KEY
};
