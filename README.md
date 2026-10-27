# CodeOrbit Tech Full Stack Development Internship
## Task 4: Secure User Authentication Web Application

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)
![Express.js](https://img.shields.io/badge/Express-5.x-blue.svg)
![bcrypt](https://img.shields.io/badge/Password%20Hashing-bcrypt%20(cost%2012)-orange.svg)
![Sessions](https://img.shields.io/badge/Session%20Store-session--file--store-indigo.svg)
![Tests](https://img.shields.io/badge/Automated%20Tests-22%2F22%20Passing-brightgreen.svg)
![License](https://img.shields.io/badge/License-ISC-lightgrey.svg)

---

## 1. Project Overview

**CodeOrbit_Task4_Authentication** is a production-grade, secure authentication web application engineered for the **CodeOrbit Tech Full Stack Development Internship**. It demonstrates real, server-enforced authentication without reliance on external third-party providers (such as Firebase, Supabase, or Auth0) or client-side illusions.

Authentication state is managed on the server using `express-session` and persistent file storage (`session-file-store`), tied to the browser exclusively through cryptographically signed `HttpOnly`, `SameSite=Lax` cookies. Sensitive user data is safeguarded with `bcrypt` (12-round salt cost factor), while the attack surface is minimized with `helmet` security headers, anti-brute-force rate limiting (`express-rate-limit`), and atomic, serialized JSON file storage.

---

## 2. Internship Task Information

- **Organization**: CodeOrbit Tech
- **Program**: Full Stack Development Internship
- **Task**: Task 4 — User Authentication Feature
- **Project Name**: `CodeOrbit_Task4_Authentication`
- **Developer**: Full Stack Developer Intern
- **Status**: Complete & Verified (22/22 Tests Passing)

---

## 3. Core Features

### 🛡️ Robust Security & Authentication
- **Bcrypt Password Hashing**: Passwords are one-way hashed with a high-cost factor of 12 rounds and unique salt. Plaintext passwords never touch persistent storage.
- **Server-Side Session Store**: Employs `session-file-store` to keep sessions persistent across server restarts, strictly avoiding dangerous in-memory session stores.
- **Session Fixation Defense**: Automatically invokes `req.session.regenerate()` upon successful authentication to destroy pre-login session IDs.
- **Timing-Attack Mitigation**: Compares dummy bcrypt hashes when looking up nonexistent emails to prevent timing-based user enumeration.
- **Brute-Force Rate Limiting**: Restricts login requests to a maximum of 5 attempts per 15-minute window per IP.
- **Aggressive Anti-Caching**: Sets `Cache-Control: no-store, no-cache, must-revalidate` headers on all protected endpoints and HTML views, preventing back-button information leakage after logout.
- **Zero Client Token Storage**: Strictly forbids storing tokens, passwords, or session identifiers in `localStorage` or `sessionStorage`.

### 🎨 Modern & Responsive Frontend
- **Design System**: Glassmorphic dark theme with radiant Indigo/Cyan ambient orbs and Google Fonts (*Plus Jakarta Sans* & *JetBrains Mono*).
- **Real-Time Password Strength Meter**: Live 4-tier visual indicator (Weak, Fair, Good, Strong) with real-time requirement validation (length, uppercase, lowercase, numbers, special characters).
- **Accessible Controls**: Password visibility toggles with SVG icons and full keyboard navigation (`aria-label`, `aria-pressed`, focus outlines).
- **Protected Dashboard**: Accessible only through server authorization, displaying user metadata, interactive API diagnostic console (`GET /api/auth/me`), client storage audit tools, and an interactive authentication pipeline visualizer.
- **Micro-Animations & Toast Engine**: Native JavaScript toast engine and button loading spinners with zero framework dependencies.

---

## 4. Technologies Used

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js (v18+) | Server-side execution environment |
| **Framework** | Express.js 5.x | HTTP routing, middleware pipeline, static serving |
| **Password Security** | bcrypt (v6.0.0) | One-way salted cryptographic hashing (Cost 12) |
| **Session Engine** | express-session (v1.19.0) | Server-side session lifecycle management |
| **Session Persistence**| session-file-store (v1.5.0) | File-based persistent session database |
| **Traffic Defense** | express-rate-limit (v8.7.1) | Anti-brute force and DoS protection |
| **HTTP Hardening** | Helmet (v8.3.0) | Content Security Policy (CSP) and HTTP security headers |
| **Configuration** | dotenv (v18.0.9) | Environment variable management |
| **Frontend UI** | HTML5 / CSS3 / Vanilla JS | Responsive, accessible, framework-free client interface |

---

## 5. Architecture & Request Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Browser / Client
    participant Express as Express.js Server
    participant Limiter as Rate Limiter & Helmet
    participant Store as JSON User Store
    participant Session as session-file-store

    %% Signup Flow
    Note over User, Session: Phase 1: User Registration
    User->>Express: POST /api/auth/signup {name, email, password}
    Express->>Limiter: Check Signup Rate Limit
    Express->>Store: Check for Duplicate Email
    Store-->>Express: Email is Unique
    Express->>Store: bcrypt.hash(password, 12) & Atomic Append to data/users.json
    Store-->>Express: Persisted Successfully
    Express-->>User: HTTP 201 Created (Safe User Object, No passwordHash)

    %% Login Flow
    Note over User, Session: Phase 2: User Login & Session Establishment
    User->>Express: POST /api/auth/login {email, password}
    Express->>Limiter: Check Login Rate Limit (Max 5 / 15m)
    Express->>Store: Find user by normalized email
    Store-->>Express: Return user record
    Express->>Express: bcrypt.compare(password, user.passwordHash)
    Express->>Session: req.session.regenerate() [Fixation Defense]
    Express->>Session: Write session payload to data/sessions/
    Express-->>User: HTTP 200 OK + Set-Cookie: codeorbit.sid (HttpOnly; SameSite=Lax)

    %% Protected Route Flow
    Note over User, Session: Phase 3: Access Protected Dashboard
    User->>Express: GET /dashboard [Cookie: codeorbit.sid]
    Express->>Session: Lookup session ID from file store
    Session-->>Express: Valid Session Found (userId)
    Express->>Express: Set Cache-Control: no-store, private
    Express-->>User: HTTP 200 OK (Render dashboard.html)

    %% Logout Flow
    Note over User, Session: Phase 4: Secure Logout
    User->>Express: POST /api/auth/logout [Cookie: codeorbit.sid]
    Express->>Session: req.session.destroy() [Delete session file]
    Express-->>User: HTTP 200 OK + Clear-Cookie: codeorbit.sid
```

---

## 6. Project Structure

```
CodeOrbit_Task4_Authentication/
├── .env.example              # Template for environment configuration
├── .gitignore                # Protects node_modules, .env, and session files
├── package.json              # Project scripts and dependency declarations
├── server.js                 # Express server bootstrap, middleware, and route mounting
├── README.md                 # Complete documentation and setup manual
│
├── src/                      # Modular backend architecture
│   ├── config.js             # Environment variable validation & fail-fast checks
│   ├── userStore.js          # Atomic file I/O with mutex queue and bcrypt hashing
│   ├── validators.js         # Input sanitization and complexity rules
│   └── middleware/
│       ├── auth.js           # Server authorization guard & anti-caching headers
│       └── rateLimiter.js    # Rate limiting middleware for endpoints
│
├── data/                     # Server-side persistent storage (Blocked from static access)
│   ├── users.json            # Persisted users with bcrypt hashes (never plain passwords)
│   └── sessions/             # Persistent session JSON files (managed by session-file-store)
│
├── public/                   # Client-side static assets (Served by Express)
│   ├── index.html            # Modern Login page
│   ├── signup.html           # Registration page with live strength meter
│   ├── dashboard.html        # Server-protected dashboard with diagnostic console
│   ├── style.css             # Glassmorphic dark design system and responsive styles
│   └── script.js             # Client interactivity, toast system, API calls (Zero localStorage)
│
└── tests/
    └── auth.test.js          # Automated end-to-end integration test suite (22 test cases)
```

---

## 7. Prerequisites

Before running the application, ensure the following are installed:
- **Node.js**: `v18.0.0` or higher (tested on Node.js v24.x)
- **npm**: `v9.0.0` or higher (installed with Node.js)
- **Web Browser**: Chrome, Edge, Firefox, or Safari with JavaScript enabled

Verify versions in your terminal:
```bash
node -v
npm -v
```

---

## 8. Installation Instructions

1. **Clone or Navigate to the Workspace Directory**:
   ```bash
   cd "C:\Users\dimpu_ziic185\OneDrive\Desktop\User Authentication Feature"
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

---

## 9. Environment Configuration

### Step 1: Copy Environment Template
Create your local `.env` file from `.env.example`:
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Bash / macOS / Linux
cp .env.example .env
```

### Step 2: How to Generate a Secure Session Secret
`express-session` requires a cryptographically strong, unguessable secret to sign session cookies. Generate a 64-character hexadecimal key by running:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Populate `.env`
Open `.env` and set the generated key:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=paste_your_generated_64_character_hex_key_here
```

> **Security Note:** In `production` (`NODE_ENV=production`), the application enforces `secure: true` on cookies (requiring HTTPS) and rejects session secrets shorter than 32 characters.

---

## 10. How to Start the Server

### Production / Standard Mode
```bash
npm start
```

### Development Mode (with Live Reload via Node --watch)
```bash
npm run dev
```

When started, the terminal will confirm:
```
========================================================
  CodeOrbit Authentication Server Running Successfully  
========================================================
  Local URL:        http://localhost:3000
  Environment:      development
  Session Store:    FileStore (data/sessions)
  Cookie Security:  HttpOnly=true, SameSite=lax, Secure=false
  Rate Limiting:    Active (5 login attempts / 15m)
========================================================
```

Open your browser to: **[http://localhost:3000](http://localhost:3000)**

---

## 11. Signup and Login Instructions

### Registering a New Account
1. Open [http://localhost:3000](http://localhost:3000) and click **"Create an account"** (or browse to [http://localhost:3000/signup.html](http://localhost:3000/signup.html)).
2. Enter your **Full Name** (e.g., `Alex Morgan`).
3. Enter your **Email Address** (e.g., `alex@codeorbit.tech`).
4. Enter a strong **Password** satisfying all security rules:
   - Minimum 8 characters (maximum 72 characters)
   - At least 1 uppercase letter (`A-Z`)
   - At least 1 lowercase letter (`a-z`)
   - At least 1 number (`0-9`)
   - At least 1 special character (`!@#$%^&*()_+-=[]{};':"|,.<>/?`)
5. Re-type the password in **Confirm Password**.
6. Toggle the **Eye Icon** to verify password visibility.
7. Click **"Complete Registration"**.
8. A green success toast will notify you and redirect you to the login screen.

### Logging In
1. On [http://localhost:3000/index.html](http://localhost:3000/index.html), enter your registered email and password.
2. Click **"Sign In to Dashboard"**.
3. Upon validation, the server regenerates your session ID and issues the `codeorbit.sid` cookie.
4. You are redirected to the **Authenticated Dashboard** (`/dashboard`).

---

## 12. How Session-Based Authentication Works

Unlike Stateless JWTs (which cannot be revoked without maintaining a distributed token blacklist), Server-Side Sessions offer deterministic security:

1. **State Ownership**: Session state resides exclusively on the server in `data/sessions/`. The client only ever possesses a signed opaque session identifier (`codeorbit.sid`).
2. **XSS Protection via HttpOnly**: The session cookie includes the `HttpOnly` flag, making it completely invisible to JavaScript execution (`document.cookie` returns empty). Even if an XSS vulnerability exists on the page, malicious scripts cannot steal session cookies.
3. **CSRF Mitigation via SameSite=Lax**: Prevents malicious third-party websites from sending the session cookie in cross-site requests.
4. **Session Fixation Defense**: Pre-auth session IDs are immediately discarded upon login via `req.session.regenerate()`, preventing attackers from presetting a victim's session ID.
5. **Instant Revocation**: Clicking **Log Out** immediately invokes `req.session.destroy()` on the server, purging the session file from disk and making immediate replay impossible.

---

## 13. API Endpoint Documentation

### Public Endpoints

#### `POST /api/auth/signup`
Creates a new user account with bcrypt password hashing.
- **Rate Limit**: 10 requests / 15 minutes / IP
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "ExamplePassword123!"
  }
  ```
- **Responses**:
  - `201 Created`: User registered successfully. Returns safe projection `{ id, name, email, createdAt }`.
  - `400 Bad Request`: Input validation failed (e.g., short password, malformed email).
  - `409 Conflict`: An account with this email already exists.
  - `429 Too Many Requests`: Rate limit exceeded.

#### `POST /api/auth/login`
Authenticates credentials and initializes a server-side session.
- **Rate Limit**: 5 attempts / 15 minutes / IP
- **Request Body**:
  ```json
  {
    "email": "jane@example.com",
    "password": "ExamplePassword123!"
  }
  ```
- **Responses**:
  - `200 OK`: Login successful. Sets `codeorbit.sid` cookie and returns safe user.
  - `400 Bad Request`: Missing fields or malformed request.
  - `401 Unauthorized`: Generic `"Invalid email or password."` (no user enumeration).
  - `429 Too Many Requests`: Rate limit exceeded.

---

### Protected Endpoints

#### `GET /api/auth/me`
Retrieves the profile of the currently authenticated user.
- **Headers**: Cookie `codeorbit.sid` required.
- **Responses**:
  - `200 OK`:
    ```json
    {
      "user": {
        "id": "97e686fb-0ecf-4ffb-8716-e575bc86d494",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "createdAt": "2026-10-27T19:55:00.000Z"
      }
    }
    ```
  - `401 Unauthorized`: Session missing or expired.

#### `POST /api/auth/logout`
Destroys the server-side session and clears the browser cookie.
- **Responses**:
  - `200 OK`:
    ```json
    {
      "message": "Logged out successfully."
    }
    ```

---

## 14. How to Test Protected Routes

### Test A: Direct Browser Access Without Authentication
1. Open a new Incognito / Private browser window.
2. Directly type `http://localhost:3000/dashboard` in the address bar.
3. Observe that the server immediately intercepts the request and issues a `302 Found` redirect to `/index.html?unauthorized=true`.
4. The login screen displays an alert: *"Session expired or unauthorized. Please log in to proceed."*

### Test B: Stale Back-Button Navigation Defense
1. Log into the dashboard.
2. Click **"Log Out"**.
3. Once redirected to the login page, click the browser's **Back Button** (`←`).
4. Because the server sets `Cache-Control: no-store, no-cache, must-revalidate`, the browser refuses to serve a cached snapshot of the dashboard and re-requests the URL, immediately bouncing back to the login page.

### Test C: Direct Data File Protection
1. Attempt to browse to `http://localhost:3000/data/users.json`.
2. Notice the server returns a `404 Not Found` response. Private data files are never exposed to Express static routing.

---

## 15. Automated Test Suite

The project includes an end-to-end automated test runner executing **22 integration tests** without any external test framework dependencies.

Run the test suite:
```bash
npm test
```

### Test Coverage Summary:
- **Section A: Signup (6 tests)**: Valid registration (201), malformed email (400), empty fields (400), short password (400), missing special character (400), duplicate email rejection (409).
- **Section B: Login (4 tests)**: Incorrect password (401), unknown email (401), successful login (200), session ID regeneration verification.
- **Section C: Protected Access (5 tests)**: Dashboard redirect without auth (302), direct `dashboard.html` block (302), `GET /api/auth/me` without auth (401), `GET /api/auth/me` with auth (200), `GET /dashboard` with auth (200 + `no-store`).
- **Section D: Logout (3 tests)**: Session destroyed & cookie cleared (200), `GET /api/auth/me` post-logout returns 401, `/dashboard` post-logout returns 302.
- **Section E: Security Controls (4 tests)**: Verification that `users.json` contains only bcrypt hashes and zero plaintext passwords, `/data/users.json` blocked (404), `/.env` blocked (404), zero `localStorage` tokens in client scripts.

---

## 16. Common Errors and Troubleshooting

| Symptom / Error | Root Cause | Solution |
|---|---|---|
| `[FATAL CONFIG ERROR] SESSION_SECRET is missing` | Missing `.env` file or `SESSION_SECRET` variable | Copy `.env.example` to `.env` and set a 32+ character key. |
| `EADDRINUSE: address already in use :::3000` | Another process is occupying port 3000 | Change `PORT=3001` in `.env` or terminate the conflicting process. |
| `Invalid email or password` | User does not exist or incorrect password entered | Use the exact email and password created during registration. |
| `Too many login attempts from this IP address` | Rate limiter triggered (exceeded 5 attempts in 15 mins) | Wait 15 minutes or restart the server in development mode to reset IP counters. |
| Session lost after browser restart | Expected session expiration | By default, session cookies expire after 24 hours (`sessionTtl = 86400`). Log in again. |

---

## 17. Security Limitations of Local JSON Storage

For local demonstration and academic assignments, JSON file storage is simple and zero-configuration. However, in production engineering, file storage presents key architectural limitations:

1. **Concurrency Bottlenecks**: Node.js is single-threaded, but multiple concurrent HTTP requests can trigger simultaneous file writes. While our implementation uses an async mutex queue and atomic renaming (`users.json.tmp` -> `users.json`), high write throughput will queue up and degrade response times.
2. **Lack of ACID Transactions**: Unlike PostgreSQL or MySQL, file storage does not support atomic multi-table rollbacks or savepoints.
3. **Memory Footprint**: Reading the entire `users.json` file parses the whole dataset into V8 heap memory on each write. This scales poorly beyond several thousand records.
4. **Horizontal Scaling**: Local file storage is pinned to a single server disk. Multiple load-balanced instances cannot share local disk files safely.

> **Production Recommendation:** For production deployments, transition `src/userStore.js` to a managed database like **PostgreSQL** (with Prisma/Knex) and replace `session-file-store` with **connect-redis** backed by a Redis cluster.

---

## 18. Deployment Considerations

When moving from local development to a live cloud host (e.g., Render, Railway, AWS, DigitalOcean):

1. **HTTPS Enforcement**:
   - Set `NODE_ENV=production` in the host's environment settings.
   - When `NODE_ENV=production`, `server.js` automatically enables `cookie: { secure: true }`, ensuring session cookies are only transmitted over TLS/SSL.
2. **Reverse Proxy Trust**:
   - If hosting behind Nginx, Cloudflare, or AWS ALB, add `app.set('trust proxy', 1)` in `server.js` so `express-rate-limit` reads the real client IP from `X-Forwarded-For`.
3. **Environment Secrets**:
   - Never commit `.env` to GitHub. Define `SESSION_SECRET` via your hosting platform's secret manager.

---

## 19. How to Safely Upload to GitHub

Follow these steps to push your internship project to GitHub without leaking private session data or environment secrets:

1. **Verify `.gitignore` Status**:
   Ensure `.env`, `node_modules/`, and `data/sessions/` are listed in `.gitignore`. Run:
   ```bash
   git status
   ```
   Confirm that `.env` and `data/sessions/` do **NOT** appear under untracked files.

2. **Initialize Git (if not already done)**:
   ```bash
   git init
   git add .
   git commit -m "feat: complete secure user authentication application for CodeOrbit Tech Internship Task 4"
   ```

3. **Link to Your GitHub Repository**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/CodeOrbit_Task4_Authentication.git
   git push -u origin main
   ```

---

## 20. Submission Screenshots Guide

Capture the following screenshots for your **CodeOrbit Tech Internship Submission**:

| Screenshot # | Description | What to Capture |
|---|---|---|
| **Screenshot 1** | **User Registration Screen** | `signup.html` showing the form filled with name, email, and the 4-bar password strength meter illuminated in green with all checkmarks met. |
| **Screenshot 2** | **Duplicate Email / Form Validation** | `signup.html` or `index.html` displaying an error banner (e.g., duplicate email conflict or password requirements not met). |
| **Screenshot 3** | **User Login Screen** | `index.html` displaying the brand header, email and password fields, and password visibility toggle active. |
| **Screenshot 4** | **Protected Dashboard View** | `dashboard.html` showing user avatar initials, welcome hero banner, user ID, and active session status badge. |
| **Screenshot 5** | **Live API Diagnostic Console** | The interactive API console on `dashboard.html` showing `200 OK` and the returned safe user JSON payload after clicking *"Test GET /api/auth/me"*. |
| **Screenshot 6** | **Zero-Token Client Storage Audit** | The diagnostic console displaying the storage audit report verifying `0` tokens in `localStorage`. |
| **Screenshot 7** | **Terminal Automated Test Suite** | Terminal window showing `npm test` with all **22/22 integration tests passing**. |
| **Screenshot 8** | **Session & Users File System** | VS Code Explorer showing `data/users.json` containing only bcrypt hashes (no plaintext passwords) and `data/sessions/` containing active session files. |

---

## 21. License

This project was built for the **CodeOrbit Tech Full Stack Development Internship**. Distributed under the ISC License.
