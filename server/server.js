import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 8080;

// Enable CORS
app.use(cors({ origin: true }));
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Config Injection Endpoint ---
// Vital for Runtime Environment Variables in Cloud Run
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
    const mode = process.env.APP_MODE || 'IDP';
    
    // Config object with only safe, public variables
    const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID
    };

    // Parse Allowed Origins
    const allowedOriginsEnv = process.env.VITE_ALLOWED_ORIGINS || '';
    const allowedOrigins = allowedOriginsEnv.split('|').map(o => o.trim()).filter(o => o);

    res.send(`window.APP_CONFIG = { 
        MODE: "${mode}",
        IDP_URL: "${process.env.VITE_IDP_URL || ''}",
        allowedOrigins: ${JSON.stringify(allowedOrigins)},
        firebase: ${JSON.stringify(firebaseConfig)}
    };`);
});

// --- Serve Static Frontend (Vite Build) ---
const DIST_PATH = path.join(__dirname, 'dist');
app.use(express.static(DIST_PATH));

// Health Check
app.get('/api/health', (req, res) => {
    res.send('ETB IDP Static Host is running');
});

// SPA Catch-All Route
app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
