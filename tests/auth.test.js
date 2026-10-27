/**
 * Comprehensive Automated Test Suite
 * CodeOrbit Tech - Task 4: Secure User Authentication
 * 
 * Tests Scenarios:
 * A. Signup (Success, Invalid Email, Empty Fields, Weak Password, Duplicate Email)
 * B. Login (Success, Incorrect Password, Unknown Email, Session Creation, Session Regeneration)
 * C. Protected Access (Dashboard without auth, Dashboard with auth, GET /api/auth/me without/with auth)
 * D. Logout (Successful logout, Access dashboard after logout, Session invalidation verification)
 * E. Security (No passwordHash returned, No plaintext passwords, Static access to /data blocked, Zero localStorage)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

// Set test environment configuration
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test_secret_for_automated_verification_suite_minimum_32_characters_12345';

const { app } = require('../server');
const userStore = require('../src/userStore');

let server;
const BASE_URL = 'http://127.0.0.1:3001';

// Cookie jar helper for tracking session cookies across requests
class CookieJar {
  constructor() {
    this.cookies = {};
  }

  storeCookies(response) {
    // Collect set-cookie headers
    const rawHeaders = response.headers.get('set-cookie');
    if (!rawHeaders) return;

    // Split multiple cookies if present
    const cookieStrings = rawHeaders.split(/,(?=\s*[^;]+=[^;]+)/);
    for (const cookieStr of cookieStrings) {
      const parts = cookieStr.split(';')[0].trim().split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=');
        if (value === '' || cookieStr.toLowerCase().includes('expires=thu, 01 jan 1970')) {
          delete this.cookies[key];
        } else {
          this.cookies[key] = value;
        }
      }
    }
  }

  getCookieHeader() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  clear() {
    this.cookies = {};
  }
}

let passedCount = 0;
let failedCount = 0;

async function runTest(testName, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${testName}`);
    console.error(`    \x1b[33m${err.message}\x1b[0m`);
    failedCount++;
  }
}

async function request(endpoint, options = {}, jar = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { ...options.headers };

  if (jar) {
    const cookieHeader = jar.getCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual', // do not auto-follow redirects so we can inspect 302
  });

  if (jar) {
    jar.storeCookies(response);
  }

  return response;
}

async function main() {
  console.log('\n============================================================');
  console.log('  CodeOrbit Tech: Full Stack Authentication Test Suite');
  console.log('============================================================\n');

  // Clean test user data prior to run
  await userStore.initializeStorage();
  await fs.promises.writeFile(userStore.USERS_FILE, JSON.stringify([], null, 2), 'utf8');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(3001, '127.0.0.1', () => {
      resolve();
    });
  });

  const testUser = {
    name: 'Sarah Connor',
    email: 'sarah.connor@cyberdyne.org',
    password: 'SecurePassword123!',
  };

  const jar = new CookieJar();

  // ==========================================================================
  // SECTION A: SIGNUP TESTS
  // ==========================================================================
  console.log('\x1b[36m--- Section A: Signup Operations ---\x1b[0m');

  await runTest('Signup with valid credentials returns 201 and safe user profile', async () => {
    const res = await request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
    const data = await res.json();
    assert(data.user, 'Expected response to contain user object');
    assert.strictEqual(data.user.email, testUser.email.toLowerCase());
    assert.strictEqual(data.user.name, testUser.name);
    assert.strictEqual(data.user.passwordHash, undefined, 'passwordHash must never be exposed');
    assert.strictEqual(data.user.password, undefined, 'plaintext password must never be exposed');
    assert(data.user.id, 'User must have a unique ID');
    assert(data.user.createdAt, 'User must have createdAt timestamp');
  });

  await runTest('Signup with invalid email format returns 400 Bad Request', async () => {
    const res = await request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid Email User',
        email: 'invalid-email-address',
        password: 'Password123!',
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert(data.error.includes('valid email'), `Expected email validation error, got: ${data.error}`);
  });

  await runTest('Signup with empty / missing fields returns 400 Bad Request', async () => {
    const res = await request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: '',
        password: '',
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert(data.error, 'Expected error message for empty fields');
  });

  await runTest('Signup with weak/short password (< 8 chars) returns 400 Bad Request', async () => {
    const res = await request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Weak Password User',
        email: 'weak@example.com',
        password: 'Pass1',
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert(data.error.includes('8 characters'), `Expected length error message, got: ${data.error}`);
  });

  await runTest('Signup with password missing special character returns 400 Bad Request', async () => {
    const res = await request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'No Special Char User',
        email: 'nospecial@example.com',
        password: 'Password123',
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert(data.error.includes('special character'), `Expected complexity error message, got: ${data.error}`);
  });

  await runTest('Signup with duplicate email returns 409 Conflict', async () => {
    const res = await request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Sarah',
        email: testUser.email.toUpperCase(), // Test case insensitivity
        password: 'AnotherPassword123!',
      }),
    });

    assert.strictEqual(res.status, 409, `Expected 409 Conflict, got ${res.status}`);
    const data = await res.json();
    assert(data.error.includes('already exists'), `Expected duplicate error, got: ${data.error}`);
  });

  // ==========================================================================
  // SECTION B: LOGIN TESTS
  // ==========================================================================
  console.log('\n\x1b[36m--- Section B: Login Operations ---\x1b[0m');

  await runTest('Login with incorrect password returns generic 401 Unauthorized', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'WrongPassword999!',
      }),
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid email or password.');
  });

  await runTest('Login with unknown email returns identical generic 401 message (no user enumeration)', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent.ghost@domain.xyz',
        password: 'SomePassword123!',
      }),
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid email or password.');
  });

  let sessionCookieBefore;

  await runTest('Successful login returns 200, sets codeorbit.sid cookie, and safe user', async () => {
    jar.clear();
    const res = await request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      },
      jar
    );

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.email, testUser.email.toLowerCase());
    assert.strictEqual(data.user.passwordHash, undefined);
    assert(jar.cookies['codeorbit.sid'], 'Expected codeorbit.sid cookie in cookie jar');
    sessionCookieBefore = jar.cookies['codeorbit.sid'];
  });

  await runTest('Session regeneration on subsequent login issues a new session ID', async () => {
    const res = await request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      },
      jar
    );

    assert.strictEqual(res.status, 200);
    const newSessionCookie = jar.cookies['codeorbit.sid'];
    assert(newSessionCookie, 'Session cookie must be present');
    assert.notStrictEqual(
      newSessionCookie,
      sessionCookieBefore,
      'Session ID must be regenerated upon re-authentication'
    );
  });

  // ==========================================================================
  // SECTION C: PROTECTED ACCESS TESTS
  // ==========================================================================
  console.log('\n\x1b[36m--- Section C: Protected Access & Authorization Guard ---\x1b[0m');

  await runTest('Accessing GET /dashboard without session redirects (302) to /index.html', async () => {
    const unauthJar = new CookieJar();
    const res = await request('/dashboard', { method: 'GET' }, unauthJar);

    assert.strictEqual(res.status, 302, `Expected 302 redirect, got ${res.status}`);
    const location = res.headers.get('location');
    assert(location.includes('/index.html'), `Expected redirect to index.html, got: ${location}`);
  });

  await runTest('Direct request to /dashboard.html without session redirects (302)', async () => {
    const unauthJar = new CookieJar();
    const res = await request('/dashboard.html', { method: 'GET' }, unauthJar);

    assert.strictEqual(res.status, 302, `Expected 302 redirect, got ${res.status}`);
    const location = res.headers.get('location');
    assert(location.includes('/index.html'), `Expected redirect to index.html, got: ${location}`);
  });

  await runTest('Calling GET /api/auth/me without authentication returns 401 Unauthorized', async () => {
    const unauthJar = new CookieJar();
    const res = await request('/api/auth/me', { method: 'GET' }, unauthJar);

    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    const data = await res.json();
    assert(data.error.includes('Unauthorized'), `Expected Unauthorized error, got: ${data.error}`);
  });

  await runTest('Calling GET /api/auth/me WITH authenticated session returns 200 and profile', async () => {
    const res = await request('/api/auth/me', { method: 'GET' }, jar);

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.user.email, testUser.email.toLowerCase());
    assert.strictEqual(data.user.name, testUser.name);
    assert.strictEqual(data.user.passwordHash, undefined);
  });

  await runTest('Accessing GET /dashboard WITH authenticated session returns 200 OK HTML', async () => {
    const res = await request('/dashboard', { method: 'GET' }, jar);

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('Authenticated Dashboard'), 'Expected dashboard HTML title');
    const cacheControl = res.headers.get('cache-control');
    assert(cacheControl.includes('no-store'), 'Protected route must set Cache-Control: no-store');
  });

  // ==========================================================================
  // SECTION D: LOGOUT TESTS
  // ==========================================================================
  console.log('\n\x1b[36m--- Section D: Logout & Invalidation ---\x1b[0m');

  await runTest('POST /api/auth/logout destroys session and clears session cookie', async () => {
    const res = await request('/api/auth/logout', { method: 'POST' }, jar);

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.message, 'Logged out successfully.');

    // Verify cookie was cleared
    assert.strictEqual(jar.cookies['codeorbit.sid'], undefined, 'Cookie should be cleared in client jar');
  });

  await runTest('GET /api/auth/me after logout returns 401 Unauthorized', async () => {
    const res = await request('/api/auth/me', { method: 'GET' }, jar);
    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await runTest('GET /dashboard after logout redirects (302) to login page', async () => {
    const res = await request('/dashboard', { method: 'GET' }, jar);
    assert.strictEqual(res.status, 302, `Expected 302 redirect, got ${res.status}`);
  });

  // ==========================================================================
  // SECTION E: SECURITY CONTROLS VERIFICATION
  // ==========================================================================
  console.log('\n\x1b[36m--- Section E: Deep Security Controls ---\x1b[0m');

  await runTest('Verify data/users.json stores only bcrypt hash and NEVER plaintext password', async () => {
    const fileContent = await fs.promises.readFile(userStore.USERS_FILE, 'utf8');
    const storedUsers = JSON.parse(fileContent);
    const userInStorage = storedUsers.find((u) => u.email === testUser.email.toLowerCase());

    assert(userInStorage, 'User must exist in users.json');
    assert(userInStorage.passwordHash.startsWith('$2b$12$'), 'passwordHash must be valid bcrypt cost 12 hash');
    assert(!userInStorage.password, 'password field must never exist in file');
    assert(!fileContent.includes(testUser.password), 'Plaintext password string must never exist in users.json');
  });

  await runTest('Direct HTTP requests to /data/users.json are blocked (404)', async () => {
    const res = await request('/data/users.json', { method: 'GET' });
    assert.strictEqual(res.status, 404, `Direct data file access must be blocked with 404, got ${res.status}`);
  });

  await runTest('Direct HTTP requests to /.env are blocked (404)', async () => {
    const res = await request('/.env', { method: 'GET' });
    assert.strictEqual(res.status, 404, `Direct .env access must be blocked with 404, got ${res.status}`);
  });

  await runTest('Verify static JavaScript script.js contains zero localStorage / sessionStorage auth writes', async () => {
    const scriptPath = path.join(__dirname, '..', 'public', 'script.js');
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf8');

    assert(!scriptContent.includes('localStorage.setItem'), 'Client script must not write tokens to localStorage');
    assert(!scriptContent.includes('sessionStorage.setItem'), 'Client script must not write tokens to sessionStorage');
  });

  // Teardown
  server.close();

  console.log('\n============================================================');
  console.log(`  Test Results Summary:`);
  console.log(`  Total:  ${passedCount + failedCount}`);
  console.log(`  Passed: \x1b[32m${passedCount}\x1b[0m`);
  console.log(`  Failed: \x1b[31m${failedCount}\x1b[0m`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\x1b[31m[Test Suite Fatal Error]:\x1b[0m', err);
  if (server) server.close();
  process.exit(1);
});
