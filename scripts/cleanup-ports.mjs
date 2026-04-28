/**
 * cleanup-ports.mjs
 *
 * Pre-flight script for `npm run dev:simulation`.
 * Cross-platform: Windows, macOS, Linux.
 *
 * Responsibilities:
 *   1. Kill zombie processes holding dev ports (3000, 5173).
 *   2. Validate Vite dependency cache integrity against package-lock.json hash.
 *      If the lockfile changed since the last run, the cache is wiped so Vite
 *      re-optimises dependencies cleanly — preventing the blank-screen / 504 bug.
 */

import { execSync }                                       from 'child_process';
import { createHash }                                     from 'crypto';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, resolve, dirname }                         from 'path';
import { fileURLToPath }                                  from 'url';

// ─── Configuration ────────────────────────────────────────────────────────────

// fileURLToPath handles Windows drive letters AND macOS/Linux paths correctly.
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');          // scripts/ → project root

const PORTS      = [3000, 5173];
const LOCKFILE   = join(ROOT, 'package-lock.json');
const VITE_CACHE = join(ROOT, 'node_modules', '.vite');
const HASH_STORE = join(ROOT, 'node_modules', '.vite-lockfile-hash');

// ─── Colours ──────────────────────────────────────────────────────────────────

const c = {
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
};

// ─── Kill processes on a port (Windows + macOS/Linux) ─────────────────────────

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      // Windows: use netstat + taskkill
      const output = execSync(
        `netstat -ano | findstr :${port}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      for (const line of output.split('\n')) {
        if (!line.includes('LISTENING')) continue;
        const pid = line.trim().split(/\s+/).at(-1);
        if (!pid || pid === '0') continue;
        process.stdout.write(`[${c.yellow('KILL')}] Port ${port} held by PID ${pid}. Terminating... `);
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(c.green('DONE'));
        } catch {
          console.log(c.red('FAILED'));
        }
      }
    } else {
      // macOS / Linux: use lsof (available on both by default)
      try {
        const pids = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf-8' }).trim();
        if (pids) {
          process.stdout.write(`[${c.yellow('KILL')}] Port ${port} held by PID(s) ${pids.replace(/\n/g, ',')}. Terminating... `);
          execSync(`kill -9 ${pids.split('\n').join(' ')}`, { stdio: 'ignore' });
          console.log(c.green('DONE'));
        }
      } catch {
        // No process on that port — fine.
      }
    }
  } catch {
    // netstat returns exit 1 when there's no match — that's expected.
  }
}

// ─── Validate Vite cache against lockfile hash ────────────────────────────────

function computeLockfileHash() {
  if (!existsSync(LOCKFILE)) return null;
  return createHash('sha256').update(readFileSync(LOCKFILE)).digest('hex');
}

function validateViteCache() {
  console.log(`[${c.cyan('CACHE')}] Validating Vite dependency cache…`);

  const currentHash = computeLockfileHash();

  if (!currentHash) {
    console.log(`[${c.yellow('CACHE')}] package-lock.json not found — skipping cache check.`);
    return;
  }

  if (!existsSync(VITE_CACHE)) {
    console.log(`[${c.green('CACHE')}] No existing cache — Vite will build it fresh.`);
    writeFileSync(HASH_STORE, currentHash, 'utf-8');
    return;
  }

  const storedHash = existsSync(HASH_STORE) ? readFileSync(HASH_STORE, 'utf-8').trim() : null;

  if (storedHash === currentHash) {
    console.log(`[${c.green('CACHE')}] Lockfile unchanged — cache is valid. ✓`);
    return;
  }

  console.log(`[${c.yellow('CACHE')}] package-lock.json changed — wiping stale Vite cache…`);
  try {
    rmSync(VITE_CACHE, { recursive: true, force: true });
    writeFileSync(HASH_STORE, currentHash, 'utf-8');
    console.log(`[${c.green('CACHE')}] Stale cache removed. Vite will re-optimise. ✓`);
  } catch (err) {
    console.log(`[${c.red('CACHE')}] Could not remove cache: ${err.message}`);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log(`[${c.cyan('CLEANUP')}] Checking zombie processes on ports: ${PORTS.join(', ')}`);
PORTS.forEach(killPort);
console.log(`[${c.green('READY')}] Ports are clear.`);
console.log('');
validateViteCache();
console.log('');
