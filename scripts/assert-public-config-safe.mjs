import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.PUBLIC_BASE_URL || 'http://localhost:5173');
const publicOrigin = new URL(baseUrl).origin;

const privateMarkers = [
  /MULESOFT_[A-Z0-9_]+/i,
  /CLIENT_SECRET/i,
  /OAUTH_CLIENT_SECRET/i,
  /RECAPTCHA_API_KEY/i,
  /GOOGLE_APPLICATION_CREDENTIALS/i,
  /FIREBASE_CONFIG/i,
  /FIREBASE_SERVICE_ACCOUNT/i,
  /PRIVATE_KEY/i,
  /SERVICE_ACCOUNT_JSON/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /x-correlation-id/i,
  /client_secret/i,
];

const googleApiKeyPattern = /AIza[0-9A-Za-z_-]{30,}/g;

const expectedConfigHeaders = {
  'cache-control': /no-store/i,
  'x-robots-tag': /noindex/i,
};

const apiProbeRequests = [
  { path: '/api/health', method: 'GET' },
  { path: '/api/customer/lookup', method: 'POST', body: {} },
  { path: '/api/customer/otp/start-login', method: 'POST', body: { email: 'bad' } },
  { path: '/api/customer/otp/send', method: 'POST', body: {} },
  { path: '/api/customer/otp/validate', method: 'POST', body: {} },
  { path: '/api/customers/register', method: 'POST', body: {} },
  { path: '/api/auth/login/complete', method: 'POST', body: {} },
];

const failures = [];
const checked = [];

const configResponse = await fetchUrl('/config.js');
await assertResponseSafe('/config.js', configResponse, { allowFirebaseWebApiKey: true });
for (const [name, pattern] of Object.entries(expectedConfigHeaders)) {
  if (!pattern.test(configResponse.headers.get(name) || '')) {
    failures.push(`/config.js missing or weak ${name} header`);
  }
}

const indexResponse = await fetchUrl('/');
const indexText = await indexResponse.text();
assertTextSafe('/', indexText);
checked.push('/');

for (const assetPath of extractSameOriginAssetPaths(indexText)) {
  const response = await fetchUrl(assetPath);
  await assertResponseSafe(assetPath, response, { allowFirebaseWebApiKey: assetPath === '/config.js' });
}

for (const request of apiProbeRequests) {
  const response = await fetchUrl(request.path, request);
  await assertResponseSafe(`${request.method} ${request.path}`, response, { allowFirebaseWebApiKey: false });
}

await assertLocalPublicFilesSafe('public');
await assertLocalPublicFilesSafe('dist');

if (failures.length > 0) {
  console.error(`[public-surface] Sensitive markers found:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`[public-surface] OK: ${checked.length} public responses/files checked from ${baseUrl}. No backend service secrets detected.`);

function normalizeBaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.pathname.endsWith('/config.js')) {
    return `${parsed.origin}/`;
  }
  return `${parsed.origin}${parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`}`;
}

async function fetchUrl(resourcePath, options = {}) {
  const url = new URL(resourcePath.replace(/^\//, ''), baseUrl);
  const init = {
    method: options.method || 'GET',
    cache: 'no-store',
    headers: {
      Origin: publicOrigin,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  };
  const response = await fetch(url, init);
  return response;
}

async function assertResponseSafe(label, response, options) {
  const text = await response.text();
  checked.push(label);
  assertTextSafe(label, text, options);
}

function assertTextSafe(label, text, options = {}) {
  const foundMarkers = privateMarkers
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);

  if (foundMarkers.length > 0) {
    failures.push(`${label}: forbidden private marker(s): ${foundMarkers.join(', ')}`);
  }

  const googleKeys = [...text.matchAll(googleApiKeyPattern)].map((match) => match[0]);
  if (googleKeys.length > 0 && !options.allowFirebaseWebApiKey) {
    failures.push(`${label}: Google API key pattern found outside runtime /config.js`);
  }
}

function extractSameOriginAssetPaths(indexHtml) {
  const paths = new Set();
  for (const match of indexHtml.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    const value = match[1];
    if (!value || value.startsWith('http:') || value.startsWith('https:') || value.startsWith('//') || value.startsWith('data:')) {
      continue;
    }
    if (value.startsWith('/assets/') || value.startsWith('/branding/') || value === '/config.js') {
      paths.add(value);
    }
  }
  return [...paths];
}

async function assertLocalPublicFilesSafe(directory) {
  try {
    const files = await listFiles(directory);
    for (const filePath of files) {
      if (!/\.(js|html|css|json|svg|txt|map)$/i.test(filePath)) continue;
      const text = await fs.readFile(filePath, 'utf8');
      const allowFirebaseWebApiKey = filePath === path.join('dist', 'config.js');
      checked.push(filePath);
      assertTextSafe(filePath, text, { allowFirebaseWebApiKey });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}
