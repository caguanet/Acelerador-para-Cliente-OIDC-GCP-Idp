#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';

const [, , envFileArg, ...command] = process.argv;

if (!envFileArg || command.length === 0) {
  console.error('Usage: node scripts/run-optional-env.mjs <env-file> <command> [...args]');
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

const envFile = resolve(process.cwd(), envFileArg);
const fileEnv = existsSync(envFile)
  ? parseEnvFile(readFileSync(envFile, 'utf8'))
  : {};

const child = spawn(command[0], command.slice(1), {
  env: { ...process.env, ...fileEnv },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
