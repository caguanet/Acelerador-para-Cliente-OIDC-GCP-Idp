/**
 * scripts/install-hooks.mjs
 *
 * Cross-platform Git hooks installer — Windows, macOS, Linux.
 * Run once manually:  node scripts/install-hooks.mjs
 * Auto-run on:        npm install  (via "prepare" lifecycle script)
 *
 * Installs Node.js-based hooks into .git/hooks/:
 *   - post-checkout  → clears Vite cache on branch switch
 *   - post-merge     → clears Vite cache when package-lock.json changes
 *
 * Why Node.js hooks instead of shell scripts?
 *   Shell hooks (.sh) need bash — not guaranteed on Windows without Git Bash.
 *   Node.js hooks via `#!/usr/bin/env node` work identically on:
 *     • Windows  (Git for Windows bundles Node-aware sh.exe)
 *     • macOS    (native bash/zsh + system Node)
 *     • Linux    (any distro with Node installed)
 */

import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs';
import { join, resolve, dirname }                           from 'path';
import { fileURLToPath }                                    from 'url';

// fileURLToPath correctly resolves Windows drive letters AND macOS/Linux paths.
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');   // scripts/ → project root
const HOOKS_DIR  = join(ROOT, '.git', 'hooks');

const c = {
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
};

// ─── Guard: must be a git repo ────────────────────────────────────────────────

if (!existsSync(join(ROOT, '.git'))) {
  console.log(`[${c.yellow('HOOKS')}] Not a git repository — skipping hook installation.`);
  process.exit(0);
}

// ─── Hook source definitions ──────────────────────────────────────────────────

/**
 * post-checkout
 * Fired by: git checkout <branch>, git switch <branch>
 * Args:     <prev-HEAD> <new-HEAD> <is-branch-switch: 0|1>
 */
const POST_CHECKOUT = `#!/usr/bin/env node
// post-checkout — managed by scripts/install-hooks.mjs
// Cross-platform (Windows / macOS / Linux): uses only Node.js built-ins.
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';

const isBranchSwitch = process.argv[4] === '1';   // git passes args at index 2,3,4

if (isBranchSwitch) {
  const cache = resolve(process.cwd(), 'node_modules', '.vite');
  if (existsSync(cache)) {
    rmSync(cache, { recursive: true, force: true });
    console.log('[git hook] Branch switched — Vite cache cleared to prevent stale deps. ✓');
  }
}
`;

/**
 * post-merge
 * Fired by: git pull, git merge
 * Only wipes cache when package-lock.json was part of the merge — avoids
 * unnecessary full rebuilds on unrelated merges.
 */
const POST_MERGE = `#!/usr/bin/env node
// post-merge — managed by scripts/install-hooks.mjs
// Cross-platform (Windows / macOS / Linux): uses only Node.js built-ins.
import { execSync }           from 'child_process';
import { existsSync, rmSync } from 'fs';
import { resolve }            from 'path';

let lockfileChanged = false;
try {
  const changed = execSync(
    'git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD',
    { encoding: 'utf-8' }
  );
  lockfileChanged = changed.includes('package-lock.json');
} catch {
  // ORIG_HEAD may not exist on first-time clone merges — safe to skip.
}

if (lockfileChanged) {
  const cache = resolve(process.cwd(), 'node_modules', '.vite');
  if (existsSync(cache)) {
    rmSync(cache, { recursive: true, force: true });
    console.log('[git hook] package-lock.json changed in merge — Vite cache cleared. ✓');
    console.log('[git hook] Tip: run npm install to sync any new/updated dependencies.');
  }
}
`;

// ─── Install ──────────────────────────────────────────────────────────────────

mkdirSync(HOOKS_DIR, { recursive: true });

const hooks = [
  { name: 'post-checkout', content: POST_CHECKOUT },
  { name: 'post-merge',    content: POST_MERGE    },
];

let allOk = true;
for (const { name, content } of hooks) {
  const hookPath = join(HOOKS_DIR, name);
  try {
    writeFileSync(hookPath, content, 'utf-8');
    // chmod 755 — no-op on Windows NTFS (Git for Windows handles executable bit internally)
    try { chmodSync(hookPath, 0o755); } catch {}
    console.log(`[${c.green('HOOKS')}] Installed .git/hooks/${name} ✓`);
  } catch (err) {
    console.log(`[${c.red('HOOKS')}] Failed to install ${name}: ${err.message}`);
    allOk = false;
  }
}

if (allOk) {
  console.log(`\n[${c.cyan('HOOKS')}] All hooks active. They run automatically on:`);
  console.log(`         • git switch / git checkout  → post-checkout`);
  console.log(`         • git pull  / git merge      → post-merge\n`);
} else {
  console.log(`\n[${c.red('HOOKS')}] Some hooks failed to install. Check permissions on .git/hooks/\n`);
  process.exit(1);
}
