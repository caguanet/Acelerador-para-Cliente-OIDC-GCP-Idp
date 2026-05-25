#!/usr/bin/env node
/**
 * Comprueba que cada entrada de skills-lock.json tiene SKILL.md local y hash coincidente.
 * Si no existe `.agents/skills` (p. ej. CI sin skills versionadas), termina 0 salvo STRICT_SKILLS_LOCK=1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256HexFile } from "./skills-hash.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const lockPath = path.join(root, "skills-lock.json");
const skillsRoot = path.join(root, ".agents", "skills");

const strict = process.env.STRICT_SKILLS_LOCK === "1" || process.env.STRICT_SKILLS_LOCK === "true";

if (!fs.existsSync(skillsRoot)) {
  const msg =
    "[verify-skills-lock] .agents/skills no encontrado — verificación omitida (versionar skills o usar scripts/setup-skills.sh en el entorno).";
  if (strict) {
    console.error(`${msg} STRICT_SKILLS_LOCK activo: fallo.`);
    process.exit(1);
  }
  console.warn(msg);
  process.exit(0);
}

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
let ok = true;

for (const id of Object.keys(lock.skills)) {
  const skillMd = path.join(skillsRoot, id, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    console.error(`[verify-skills-lock] Falta skill "${id}" en ${skillMd}`);
    ok = false;
    continue;
  }
  const actual = sha256HexFile(skillMd);
  const expected = lock.skills[id].computedHash;
  if (actual !== expected) {
    console.error(
      `[verify-skills-lock] Hash distinto para "${id}"\n  esperado: ${expected}\n  actual:   ${actual}\n  Ejecute: pnpm run skills:refresh-lock`,
    );
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log("[verify-skills-lock] OK (hashes alineados con skills-lock.json).");
