#!/usr/bin/env node
/**
 * Recalcula `computedHash` en skills-lock.json a partir de `.agents/skills/<id>/SKILL.md`.
 * Ejecutar tras actualizar skills locales para alinear el pin con el disco.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256HexFile } from "./skills-hash.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const lockPath = path.join(root, "skills-lock.json");
const skillsRoot = path.join(root, ".agents", "skills");

const raw = fs.readFileSync(lockPath, "utf8");
const lock = JSON.parse(raw);

let changed = 0;
for (const id of Object.keys(lock.skills)) {
  const skillMd = path.join(skillsRoot, id, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    console.error(`[update-skills-lock] Falta ${skillMd}; no se puede actualizar hash de "${id}".`);
    process.exit(1);
  }
  const h = sha256HexFile(skillMd);
  if (lock.skills[id].computedHash !== h) {
    lock.skills[id].computedHash = h;
    changed++;
  }
}

fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
console.log(`[update-skills-lock] skills-lock.json actualizado (${changed} hash(es) cambiados).`);
