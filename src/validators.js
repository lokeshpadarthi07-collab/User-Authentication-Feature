/**
 * Input Validation and Sanitization Module
 * Enforces rigorous checks for signup and login requests.
 */

// Email regex adhering to standard RFC formats
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Password constraints
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72; // Bcrypt algorithms truncate input beyond 72 bytes

/**
 * Validates and normalizes signup input
 * @param {Object} data - { name, email, password }
 * @returns {Object} { isValid, error, sanitized }
 */
function validateSignupInput(data = {}) {
  const { name, email, password } = data;

  // Name validation
  if (typeof name !== 'string') {
    return { isValid: false, error: 'Full name is required and must be text.' };
  }
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    return { isValid: false, error: 'Full name must be at least 2 characters long.' };
  }
  if (trimmedName.length > 50) {
    return { isValid: false, error: 'Full name cannot exceed 50 characters.' };
  }
  // Disallow dangerous control or HTML markup characters in name
  if (/[<>]/.test(trimmedName)) {
    return { isValid: false, error: 'Full name cannot contain HTML tags or angle brackets.' };
  }

  // Email validation
  if (typeof email !== 'string') {
    return { isValid: false, error: 'Valid email address is required.' };
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length === 0) {
    return { isValid: false, error: 'Email address cannot be empty.' };
  }
  if (normalizedEmail.length > 254) {
    return { isValid: false, error: 'Email address exceeds maximum length of 254 characters.' };
  }
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { isValid: false, error: 'Please provide a valid email format (e.g., user@example.com).' };
  }

  // Password validation
  if (typeof password !== 'string') {
    return { isValid: false, error: 'Password is required and must be text.' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { isValid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { isValid: false, error: `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters.` };
  }

  // Password complexity: requires lowercase, uppercase, number, and special character
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (!hasLower || !hasUpper || !hasDigit || !hasSpecial) {
    return {
      isValid: false,
      error: 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character.',
    };
  }

  return {
    isValid: true,
    error: null,
    sanitized: {
      name: trimmedName,
      email: normalizedEmail,
      password: password, // Retain exact string for hashing
    },
  };
}

/**
 * Validates and normalizes login input
 * @param {Object} data - { email, password }
 * @returns {Object} { isValid, error, sanitized }
 */
function validateLoginInput(data = {}) {
  const { email, password } = data;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return { isValid: false, error: 'Both email and password are required.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length === 0 || password.length === 0) {
    return { isValid: false, error: 'Email and password cannot be empty.' };
  }

  if (normalizedEmail.length > 254 || password.length > PASSWORD_MAX_LENGTH) {
    return { isValid: false, error: 'Invalid email or password format.' };
  }

  return {
    isValid: true,
    error: null,
    sanitized: {
      email: normalizedEmail,
      password: password,
    },
  };
}

module.exports = {
  validateSignupInput,
  validateLoginInput,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
};
