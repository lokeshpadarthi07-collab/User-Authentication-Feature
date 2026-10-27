/**
 * Server-Side Authentication & Session Authorization Middleware
 * Enforces server-level protection and prevents browser caching of private content.
 */

/**
 * Middleware that sets aggressive cache control headers to prevent
 * browsers from caching private pages or authenticated API responses.
 * This guarantees that clicking the browser 'Back' button after logout
 * cannot reveal sensitive user data from the browser disk/memory cache.
 */
function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

/**
 * Middleware to require an active authenticated session
 */
function requireAuth(req, res, next) {
  // Always apply cache-prevention headers on protected paths
  setNoCacheHeaders(res);

  // Check if session contains a valid authenticated user ID
  if (req.session && req.session.userId) {
    return next();
  }

  // Determine if the client is requesting JSON or an API endpoint
  const original = req.originalUrl || req.url || '';
  const isApiRequest =
    original.startsWith('/api/') ||
    (req.baseUrl && req.baseUrl.startsWith('/api/')) ||
    req.path.startsWith('/api/') ||
    req.headers.accept?.includes('application/json');

  if (isApiRequest) {
    return res.status(401).json({
      error: 'Unauthorized. Please log in to access this resource.',
    });
  }

  // For browser page requests, redirect to login page with clear feedback query
  return res.redirect('/index.html?unauthorized=true');
}

/**
 * Middleware to redirect already logged-in users away from login/signup pages
 */
function redirectIfAuthenticated(req, res, next) {
  setNoCacheHeaders(res);

  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }

  next();
}

module.exports = {
  requireAuth,
  redirectIfAuthenticated,
  setNoCacheHeaders,
};
