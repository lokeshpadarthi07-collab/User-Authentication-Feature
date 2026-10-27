const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const FileStoreFactory = require('session-file-store');
const helmet = require('helmet');
const bcrypt = require('bcrypt');

const config = require('./src/config');
const userStore = require('./src/userStore');
const { validateSignupInput, validateLoginInput } = require('./src/validators');
const { requireAuth, redirectIfAuthenticated, setNoCacheHeaders } = require('./src/middleware/auth');
const { loginRateLimiter, signupRateLimiter, generalApiLimiter } = require('./src/middleware/rateLimiter');

const app = express();

// Ensure sessions directory exists before initializing FileStore
const SESSIONS_DIR = path.join(__dirname, 'data', 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// 1. Security HTTP Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Body Parsers with Strict Size Limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// 3. Persistent Server-Side Session Setup with session-file-store
const FileStore = FileStoreFactory(session);
const sessionStore = new FileStore({
  path: SESSIONS_DIR,
  ttl: config.sessionTtl,
  retries: 5,
  factor: 1.5,
  minTimeout: 80,
  maxTimeout: 1000,
  reapInterval: 3600, // session reaping interval in seconds
  logFn: () => {},    // suppress internal file-store info logs
});

app.use(
  session({
    store: sessionStore,
    name: config.sessionCookieName,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,                               // Mitigate XSS cookie theft
      sameSite: 'lax',                              // Defense against CSRF
      secure: config.isProduction,                  // HTTPS only in production, HTTP locally
      maxAge: config.sessionTtl * 1000,             // 24 hours in milliseconds
      path: '/',
    },
  })
);

// 4. Block Private Storage Directories from Static Requests
app.use((req, res, next) => {
  const lowerPath = req.path.toLowerCase();
  if (
    lowerPath.startsWith('/data') ||
    lowerPath.startsWith('/src') ||
    lowerPath.startsWith('/tests') ||
    lowerPath.includes('.env') ||
    lowerPath.includes('package.json')
  ) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

// 5. Explicit HTML Page Routes with Server-Side Guarding
const PUBLIC_DIR = path.join(__dirname, 'public');

// Root route: redirects based on authentication status
app.get('/', (req, res) => {
  setNoCacheHeaders(res);
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/index.html');
});

// Protected Dashboard Page
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

// Intercept direct requests to dashboard.html to enforce authentication
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

// Guest Pages: redirect to dashboard if user is already logged in
app.get(['/index.html', '/login'], redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get(['/signup.html', '/signup'], redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'signup.html'));
});

// 6. Serve Public Static Assets (CSS, JS, Favicon, etc.)
app.use(
  express.static(PUBLIC_DIR, {
    index: false,
    dotfiles: 'ignore',
  })
);

// 7. Authentication API Routes
const authRouter = express.Router();

/**
 * POST /api/auth/signup
 * Accepts: { name, email, password }
 */
authRouter.post('/signup', signupRateLimiter, async (req, res, next) => {
  try {
    // 1. Validate Input
    const validation = validateSignupInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    const { name, email, password } = validation.sanitized;

    // 2. Persist User (Checks for duplicates, hashes with bcrypt)
    const newUser = await userStore.createUser({ name, email, password });

    // 3. Return Safe User Object (No passwordHash)
    return res.status(201).json({
      message: 'Account created successfully! You can now log in.',
      user: newUser,
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Accepts: { email, password }
 */
authRouter.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    // 1. Validate Input
    const validation = validateLoginInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    const { email, password } = validation.sanitized;

    // 2. Lookup User
    const user = await userStore.findUserByEmail(email);

    // Timing-attack mitigation: compare with dummy hash if user not found
    if (!user) {
      // Dummy hash matching bcrypt cost 12
      const dummyHash = '$2b$12$e80yqYxO0vD6y/Wz8.xPKe019Gv4M81Z9g/3iR8XqZ8kY5w0b2s5O';
      await bcrypt.compare(password, dummyHash).catch(() => {});
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 3. Verify Password Hash
    const isPasswordValid = await userStore.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 4. Session Fixation Mitigation: Regenerate Session ID upon authentication
    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }

      // Attach authenticated user identity to regenerated session
      req.session.userId = user.id;

      // Save session to persistent store before responding
      req.session.save((saveErr) => {
        if (saveErr) {
          return next(saveErr);
        }

        return res.status(200).json({
          message: 'Login successful.',
          user: userStore.toSafeUser(user),
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Returns authenticated user profile or 401 Unauthorized
 */
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await userStore.findUserById(req.session.userId);
    if (!user) {
      // User may have been removed; destroy invalid session
      req.session.destroy(() => {
        res.clearCookie(config.sessionCookieName, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: config.isProduction,
        });
        return res.status(401).json({ error: 'User account no longer exists.' });
      });
      return;
    }

    return res.status(200).json({
      user: userStore.toSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Destroys server-side session and invalidates cookie
 */
authRouter.post('/logout', (req, res, next) => {
  setNoCacheHeaders(res);

  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Logout Error]:', err);
        return res.status(500).json({ error: 'Could not log out at this time.' });
      }

      res.clearCookie(config.sessionCookieName, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction,
      });

      return res.status(200).json({ message: 'Logged out successfully.' });
    });
  } else {
    res.clearCookie(config.sessionCookieName, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
    });
    return res.status(200).json({ message: 'Logged out successfully.' });
  }
});

// Mount Auth API Router
app.use('/api/auth', generalApiLimiter, authRouter);

// 8. Handle 404 for Unknown Endpoints
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.status(404).redirect('/index.html');
});

// 9. Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('\x1b[31m[Server Error]:\x1b[0m', err);

  const statusCode = err.status || 500;
  const message = config.isProduction ? 'Internal Server Error' : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
  });
});

// 10. Startup and Initialization
async function startServer() {
  try {
    await userStore.initializeStorage();
    const server = app.listen(config.port, () => {
      console.log(`\x1b[32m========================================================\x1b[0m`);
      console.log(`\x1b[32m  CodeOrbit Authentication Server Running Successfully  \x1b[0m`);
      console.log(`\x1b[32m========================================================\x1b[0m`);
      console.log(`  Local URL:        http://localhost:${config.port}`);
      console.log(`  Environment:      ${config.nodeEnv}`);
      console.log(`  Session Store:    FileStore (data/sessions)`);
      console.log(`  Cookie Security:  HttpOnly=true, SameSite=lax, Secure=${config.isProduction}`);
      console.log(`  Rate Limiting:    Active (5 login attempts / 15m)`);
      console.log(`========================================================`);
    });

    return server;
  } catch (error) {
    console.error('\x1b[31m[Startup Failure]:\x1b[0m', error);
    process.exit(1);
  }
}

// Start server when executed directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
