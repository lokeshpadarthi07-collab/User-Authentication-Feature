const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * ============================================================================
 * ARCHITECTURAL NOTE: LIMITATIONS OF JSON FILE STORAGE IN PRODUCTION
 * ============================================================================
 * While JSON file storage is simple and zero-dependency for local development
 * and internship demonstrations, it has significant limitations in production:
 * 
 * 1. Concurrency & Locking: Unlike relational databases (e.g., PostgreSQL)
 *    or document stores (e.g., MongoDB) that feature row-level/document-level
 *    locking and ACID transactions, file-based storage must serialize entire
 *    file writes. Under high concurrent writes, it creates bottlenecks.
 * 
 * 2. Memory Footprint: The entire user collection must be loaded and parsed
 *    into V8 memory on each read/write cycle. For thousands of users, this
 *    wastes memory and CPU time.
 * 
 * 3. Horizontal Scaling: File storage binds the application to a single server
 *    disk. If multiple instances or serverless functions run behind a load
 *    balancer, they cannot share local file storage without distributed mounts
 *    (which risk file locks and cache incoherency).
 * 
 * 4. Indexing & Querying: No B-Tree or Hash indexes exist, forcing O(N) full
 *    scans for user lookups by email or ID.
 * 
 * In this implementation, we mitigate local corruption risks using:
 *  - Mutex Write Queue: Serializes all write operations sequentially.
 *  - Atomic File Renaming: Writes to a temporary `.tmp` file and renames it,
 *    ensuring the main file is never partially written if a process crashes.
 *  - Corruption Guard: If reading/parsing fails, we never overwrite the file.
 * ============================================================================
 */

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TMP_FILE = path.join(DATA_DIR, 'users.json.tmp');
const BCRYPT_SALT_ROUNDS = 12;

// Mutex write queue to serialize file modifications
let writeQueue = Promise.resolve();

/**
 * Enqueues an operation to be executed sequentially after all prior operations complete.
 * @param {Function} task - Async function returning a promise
 * @returns {Promise}
 */
function enqueue(task) {
  const result = writeQueue.then(task, task);
  writeQueue = result.catch(() => {});
  return result;
}

/**
 * Ensures data directory and users.json exist with valid JSON array
 */
async function initializeStorage() {
  try {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.promises.access(USERS_FILE, fs.constants.F_OK);
      // Validate that existing file contains valid JSON
      const content = await fs.promises.readFile(USERS_FILE, 'utf8');
      JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File does not exist, initialize with empty array
        await fs.promises.writeFile(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
      } else {
        console.error('\x1b[31m[CRITICAL] Existing users.json is corrupted or unreadable:\x1b[0m', err.message);
        throw new Error('Database file corrupted. Preserving existing file without overwriting.');
      }
    }
  } catch (error) {
    console.error('[Storage Init Error]:', error);
    throw error;
  }
}

/**
 * Safely reads all users from users.json
 * @returns {Promise<Array>} Array of user objects
 */
async function readUsers() {
  await initializeStorage();
  try {
    const raw = await fs.promises.readFile(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Read Users Error]: Failed to parse users.json:', err.message);
    throw new Error('Unable to read user storage safely.');
  }
}

/**
 * Atomically writes user array to users.json via temporary file swap with retry logic
 * @param {Array} users - Complete array of users
 */
async function writeUsersAtomic(users) {
  const jsonContent = JSON.stringify(users, null, 2);
  // Write to temporary file first
  await fs.promises.writeFile(TMP_FILE, jsonContent, 'utf8');

  // Atomic rename with retry mechanism for Windows/OneDrive file locking
  let retries = 5;
  while (retries > 0) {
    try {
      await fs.promises.rename(TMP_FILE, USERS_FILE);
      return;
    } catch (err) {
      if ((err.code === 'EPERM' || err.code === 'EBUSY') && retries > 1) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        retries--;
      } else {
        throw err;
      }
    }
  }
}

/**
 * Returns a safe projection of the user object (EXCLUDES passwordHash)
 * @param {Object} user 
 * @returns {Object} Safe user object
 */
function toSafeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

/**
 * Finds user by normalized email
 * @param {string} email 
 * @returns {Promise<Object|null>} Full user record or null
 */
async function findUserByEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const users = await readUsers();
  return users.find((u) => u.email === normalized) || null;
}

/**
 * Finds user by unique ID
 * @param {string} id 
 * @returns {Promise<Object|null>} Full user record or null
 */
async function findUserById(id) {
  if (!id) return null;
  const users = await readUsers();
  return users.find((u) => u.id === id) || null;
}

/**
 * Creates and persists a new user with bcrypt password hash
 * @param {Object} userData - { name, email, password }
 * @returns {Promise<Object>} Safe user object (no passwordHash)
 */
async function createUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  return enqueue(async () => {
    const users = await readUsers();

    // Check for duplicate email (case-insensitive)
    const exists = users.some((u) => u.email === normalizedEmail);
    if (exists) {
      const error = new Error('An account with this email address already exists.');
      error.code = 'DUPLICATE_EMAIL';
      error.status = 409;
      throw error;
    }

    // Hash the password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const newUser = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await writeUsersAtomic(users);

    return toSafeUser(newUser);
  });
}

/**
 * Verifies a plain text password against stored bcrypt hash
 * @param {string} plainPassword 
 * @param {string} passwordHash 
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plainPassword, passwordHash) {
  if (!plainPassword || !passwordHash) return false;
  return bcrypt.compare(plainPassword, passwordHash);
}

module.exports = {
  initializeStorage,
  findUserByEmail,
  findUserById,
  createUser,
  verifyPassword,
  toSafeUser,
  DATA_DIR,
  USERS_FILE,
};
