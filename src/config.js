const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();

const port = parseInt(process.env.PORT, 10) || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const sessionSecret = process.env.SESSION_SECRET;

// Validate required environment variables at startup
if (!sessionSecret) {
  console.error('\x1b[31m[FATAL CONFIG ERROR] SESSION_SECRET is missing in environment variables.\x1b[0m');
  console.error('Please define SESSION_SECRET in your .env file.');
  console.error('Generate a secure 32+ character key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

if (isProduction && sessionSecret.length < 32) {
  console.error('\x1b[31m[FATAL CONFIG ERROR] In production, SESSION_SECRET must be at least 32 characters long.\x1b[0m');
  process.exit(1);
}

if (sessionSecret === 'replace_with_a_secure_random_string_of_at_least_32_characters') {
  console.warn('\x1b[33m[SECURITY WARNING] You are using the default placeholder SESSION_SECRET from .env.example. Generate a unique secret for production!\x1b[0m');
}

module.exports = {
  port,
  nodeEnv,
  isProduction,
  sessionSecret,
  sessionTtl: 24 * 60 * 60, // 24 hours in seconds
  sessionCookieName: 'codeorbit.sid',
};
