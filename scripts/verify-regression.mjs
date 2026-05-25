#!/usr/bin/env node
/**
 * Verificación mínima de no regresión tras cambios locales.
 *
 * Ejecución:
 *   pnpm run verify:regression
 * Con E2E (Playwright, más lento):
 *   VERIFY_E2E=1 pnpm run verify:regression
 *
 * No modifica estado del proyecto ni despliegue; solo ejecuta comandos estándar.
 */
import { spawnSync } from "node:child_process";

/** @type {(cmd: string, args: string[], label?: string) => boolean} */
function run(cmd, args, label = `${cmd} ${args.join(" ")}`) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`[verify-regression] Falló: ${label} (exit ${r.status ?? "unknown"})`);
    return false;
  }
  return true;
}

const runE2E = process.env.VERIFY_E2E === "1" || process.env.VERIFY_E2E === "true";

console.log("[verify-regression] Lock de skills (sin carpeta → aviso y continúa)...");
if (!run("node", ["scripts/verify-skills-lock.mjs"])) process.exit(1);

console.log("[verify-regression] Build + TypeScript...");
if (!run("pnpm", ["run", "build"])) process.exit(1);

console.log("[verify-regression] Vitest (run once)...");
if (!run("pnpm", ["exec", "vitest", "run"])) process.exit(1);

if (runE2E) {
  console.log("[verify-regression] Playwright E2E (VERIFY_E2E activo)...");
  if (!run("pnpm", ["run", "test:e2e"])) process.exit(1);
} else {
  console.log("[verify-regression] E2E omitido. Active con VERIFY_E2E=1 si aplica esta fase.");
}

console.log("[verify-regression] OK.");
