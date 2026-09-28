// Location in the desktop review workbench always targets a local test app.
// The origin check in main.cjs limits the grant to that app's own pages.
function reviewLocationAllowed(config) {
  if (config?.baseURL !== 'http://localhost:3100') return false;
  try {
    const backend = new URL(config.backendOrigin);
    return backend.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(backend.hostname) &&
      backend.port === '54321' && backend.pathname === '/' && !backend.username && !backend.password &&
      !backend.search && !backend.hash;
  } catch { return false; }
}

module.exports = { reviewLocationAllowed };
