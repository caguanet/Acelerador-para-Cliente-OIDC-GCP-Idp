#!/usr/bin/env node
import { execFileSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const envFile = resolve(process.cwd(), '.env.qa.local');

if (!existsSync(envFile)) {
  console.error(`Environment file not found: ${envFile}`);
  process.exit(1);
}

function parseEnvFile(contents) {
  const env = {};
  for (const rawLine of contents.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
  return env;
}

function readSecret(projectId, secretName) {
  return execFileSync(
    'gcloud',
    [
      'secrets',
      'versions',
      'access',
      'latest',
      `--secret=${secretName}`,
      `--project=${projectId}`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

function withGcpRecaptchaSecrets(env) {
  const projectId = env.RECAPTCHA_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || 'etb-identity-omnicanal';
  const nextEnv = { ...env, RECAPTCHA_PROJECT_ID: projectId };

  for (const secretName of ['RECAPTCHA_SITE_KEY', 'RECAPTCHA_API_KEY']) {
    if (!nextEnv[secretName]) {
      try {
        nextEnv[secretName] = readSecret(projectId, secretName);
      } catch (error) {
        console.error(`Could not read ${secretName} from Secret Manager. Run gcloud auth login and verify access.`);
        process.exit(error.status || 1);
      }
    }
  }

  nextEnv.VITE_RECAPTCHA_SITE_KEY = nextEnv.VITE_RECAPTCHA_SITE_KEY || nextEnv.RECAPTCHA_SITE_KEY;
  return nextEnv;
}

const qaEnv = withGcpRecaptchaSecrets(parseEnvFile(readFileSync(envFile, 'utf8')));
const childProcesses = [];

function start(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...qaEnv, ...extraEnv },
    shell: process.platform === 'win32',
    stdio: 'pipe',
  });

  childProcesses.push(child);

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      stopAll(signal);
      return;
    }

    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}

function stopAll(signal = 'SIGTERM') {
  for (const child of childProcesses) {
    if (!child.killed) child.kill(signal);
  }
}

process.on('SIGINT', () => {
  stopAll('SIGINT');
  process.exit(130);
});

process.on('SIGTERM', () => {
  stopAll('SIGTERM');
  process.exit(143);
});

console.log('Starting QA BFF on http://localhost:8080 and Vite SPA on http://localhost:5173');
start('bff', 'pnpm', ['--dir', 'server', 'start']);
start('spa', 'pnpm', ['exec', 'vite', '--force'], { NODE_ENV: 'development' });
