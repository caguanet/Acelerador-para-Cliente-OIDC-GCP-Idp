import fs from "node:fs";
import crypto from "node:crypto";

/**
 * SHA-256 hexadecimal del contenido binario exacto del archivo (coherente con `shasum -a 256`).
 * @param {string} filepath
 */
export function sha256HexFile(filepath) {
  const buf = fs.readFileSync(filepath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}
