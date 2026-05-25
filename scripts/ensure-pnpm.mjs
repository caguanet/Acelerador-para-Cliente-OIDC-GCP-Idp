#!/usr/bin/env node

const userAgent = process.env.npm_config_user_agent || "";
const execPath = process.env.npm_execpath || "";

if (userAgent.startsWith("pnpm/") || execPath.includes("pnpm")) {
  process.exit(0);
}

console.error("Este proyecto usa pnpm exclusivamente. Ejecuta: pnpm install");
process.exit(1);
