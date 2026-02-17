const fs = require('fs');
const path = require('path');

const files = [
    'gcloud',
    'debug-oidc.png',
    'tests/e2e/specs/debug-render.spec.ts'
];

console.log('--- NUKING FILES ---');

files.forEach(file => {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
        try {
            fs.unlinkSync(fullPath);
            console.log(`[OK] Deleted: ${file}`);
        } catch (e) {
            console.error(`[ERR] Failed to delete ${file}: ${e.message}`);
        }
    } else {
        console.log(`[SKIP] Not found: ${file}`);
    }
});
