/**
 * SmartCopons — Hostinger Entry Point
 *
 * This wrapper handles:
 * 1. Manual .env loading (standalone server may not auto-load it)
 * 2. Phusion Passenger compatibility (Hostinger's Node.js manager)
 * 3. Better error logging for debugging
 */

const path = require('path');
const fs = require('fs');

// === Step 1: Load .env manually ===
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
  console.log('[SmartCopons] Loaded .env file');
} else {
  console.warn('[SmartCopons] WARNING: No .env file found at', envPath);
}

// === Step 2: Validate critical env vars ===
const required = ['DATABASE_URL'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('[SmartCopons] FATAL: Missing environment variables:', missing.join(', '));
  console.error('[SmartCopons] Create a .env file in:', __dirname);
  console.error('[SmartCopons] Required vars: DATABASE_URL, APP_SECRET');
  // Don't exit — let the server start so the diagnostic page works
}

// === Step 3: Set defaults ===
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';

console.log('[SmartCopons] Starting server...');
console.log('[SmartCopons] NODE_ENV:', process.env.NODE_ENV);
console.log('[SmartCopons] PORT:', process.env.PORT);
console.log('[SmartCopons] DATABASE_URL:', process.env.DATABASE_URL ? '✓ set' : '✗ MISSING');
console.log('[SmartCopons] APP_SECRET:', process.env.APP_SECRET ? '✓ set' : '✗ MISSING');
console.log('[SmartCopons] __dirname:', __dirname);

// === Step 4: Start Next.js standalone server ===
try {
  require('./server.js');
} catch (err) {
  console.error('[SmartCopons] FATAL ERROR starting server:', err.message);
  console.error(err.stack);

  // Fallback: start a minimal HTTP server showing the error
  const http = require('http');
  const port = parseInt(process.env.PORT, 10) || 3000;
  http.createServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head><meta charset="utf-8"><title>SmartCopons - Server Error</title></head>
      <body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px;direction:ltr">
        <h1 style="color:red">⚠️ SmartCopons Server Error</h1>
        <p><strong>The Next.js server failed to start.</strong></p>
        <h3>Error:</h3>
        <pre style="background:#f5f5f5;padding:15px;overflow:auto;border:1px solid #ddd">${err.message}\n\n${err.stack}</pre>
        <h3>Environment Check:</h3>
        <ul>
          <li>DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ MISSING'}</li>
          <li>APP_SECRET: ${process.env.APP_SECRET ? '✅ Set' : '❌ MISSING'}</li>
          <li>NODE_ENV: ${process.env.NODE_ENV || 'not set'}</li>
          <li>.env file: ${fs.existsSync(envPath) ? '✅ Found' : '❌ NOT FOUND'}</li>
          <li>server.js: ${fs.existsSync(path.join(__dirname, 'server.js')) ? '✅ Found' : '❌ NOT FOUND'}</li>
          <li>.next folder: ${fs.existsSync(path.join(__dirname, '.next')) ? '✅ Found' : '❌ NOT FOUND'}</li>
        </ul>
        <h3>Fix Steps:</h3>
        <ol>
          <li>SSH into the server</li>
          <li>cd to this app's directory</li>
          <li>Check .env file exists with correct DATABASE_URL</li>
          <li>Run: <code>node -e "require('./server.js')"</code> to see detailed error</li>
        </ol>
      </body></html>
    `);
  }).listen(port, '0.0.0.0', () => {
    console.log(`[SmartCopons] Fallback error server running on port ${port}`);
  });
}
