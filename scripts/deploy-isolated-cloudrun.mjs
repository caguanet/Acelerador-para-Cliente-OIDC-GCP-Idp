import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const config = {
  projectId: process.env.PROJECT_ID || 'etb-identity-omnicanal',
  region: process.env.REGION || 'us-east1',
  artifactRepo: process.env.ARTIFACT_REPO_NAME || 'idp-repo',
  idpServiceName: process.env.IDP_SERVICE_NAME || 'idp-service-otp-preview',
  mockServiceName: process.env.MOCK_SERVICE_NAME || 'mock-client-otp-preview',
  serviceAccount: process.env.SERVICE_ACCOUNT || 'idp-service-sa@etb-identity-omnicanal.iam.gserviceaccount.com',
  clientId: process.env.OIDC_CLIENT_ID || 'etb-identity-omnicanal',
  responseType: process.env.OIDC_RESPONSE_TYPE || 'token',
  scope: process.env.OIDC_SCOPE || 'openid profile email',
  appEnv: process.env.APP_ENV || 'qa',
  requireOidcRedirect: process.env.REQUIRE_OIDC_REDIRECT || 'false',
  mulesoftEnableMs4: process.env.MULESOFT_ENABLE_MS4 || 'false',
  dryRun: process.argv.includes('--dry-run'),
};

const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const imageBase = `${config.region}-docker.pkg.dev/${config.projectId}/${config.artifactRepo}`;
const idpImage = `${imageBase}/${config.idpServiceName}:${runId}`;
const mockImage = `${imageBase}/${config.mockServiceName}:${runId}`;
const tmpDir = path.join('tmp', 'cloudrun-isolated');
const mockBuildConfig = path.join(tmpDir, `cloudbuild-mock-${runId}.yaml`);

const secretMappings = [
  'VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest',
  'VITE_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN:latest',
  'VITE_FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest',
  'RECAPTCHA_PROJECT_ID=RECAPTCHA_PROJECT_ID:latest',
  'RECAPTCHA_SITE_KEY=RECAPTCHA_SITE_KEY:latest',
  'RECAPTCHA_API_KEY=RECAPTCHA_API_KEY:latest',
  'MULESOFT_OAUTH_URL=MULESOFT_OAUTH_URL:latest',
  'MULESOFT_BASE_URL_MS1=MULESOFT_BASE_URL_MS1:latest',
  'MULESOFT_BASE_URL_MS2=MULESOFT_BASE_URL_MS2:latest',
  'MULESOFT_BASE_URL_MS3=MULESOFT_BASE_URL_MS3:latest',
  'MULESOFT_CLIENT_ID=MULESOFT_CLIENT_ID:latest',
  'MULESOFT_CLIENT_SECRET=MULESOFT_CLIENT_SECRET:latest',
  'MULESOFT_OAUTH_ACCOUNT_ID=MULESOFT_OAUTH_ACCOUNT_ID:latest',
];

console.log(`[deploy] Proyecto: ${config.projectId}`);
console.log(`[deploy] Region: ${config.region}`);
console.log(`[deploy] IdP aislado: ${config.idpServiceName}`);
console.log(`[deploy] Mock aislado: ${config.mockServiceName}`);
console.log(`[deploy] Imagen IdP: ${idpImage}`);
console.log(`[deploy] Imagen mock: ${mockImage}`);

await ensureGcloudAuth();
await ensureServiceAccountSecretAccess();
await buildIdpImage();
await deployIdpInitial();
const idpUrl = await describeServiceUrl(config.idpServiceName);

await buildMockImage();
await deployMockInitial(idpUrl);
const mockUrl = await describeServiceUrl(config.mockServiceName);

await updateMockRuntime(idpUrl, mockUrl);
await updateIdpRuntime(idpUrl, mockUrl);

console.log('\n[deploy] Despliegue aislado listo.');
console.log(`[deploy] IdP URL:  ${idpUrl}`);
console.log(`[deploy] Mock URL: ${mockUrl}`);
console.log('\n[deploy] No se actualizo el servicio Cloud Run existente idp-service.');

async function ensureGcloudAuth() {
  if (config.dryRun) {
    console.log('[dry-run] Skipping active gcloud account validation');
    return;
  }

  const account = await capture('gcloud', ['auth', 'list', '--filter=status:ACTIVE', "--format=value(account)"]);
  if (!account.trim()) {
    throw new Error('No hay cuenta activa de gcloud. Ejecuta gcloud auth login antes del deploy.');
  }
  const project = await capture('gcloud', ['config', 'get-value', 'project']);
  console.log(`[deploy] Cuenta gcloud activa: ${account.trim()}`);
  console.log(`[deploy] Proyecto gcloud activo: ${project.trim()}`);
}

async function ensureServiceAccountSecretAccess() {
  await run('gcloud', [
    'projects',
    'add-iam-policy-binding',
    config.projectId,
    `--member=serviceAccount:${config.serviceAccount}`,
    '--role=roles/secretmanager.secretAccessor',
    `--project=${config.projectId}`,
  ]);
}

async function buildIdpImage() {
  await run('gcloud', [
    'builds',
    'submit',
    `--tag=${idpImage}`,
    `--project=${config.projectId}`,
  ]);
}

async function buildMockImage() {
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.writeFile(mockBuildConfig, [
    'steps:',
    "- name: 'gcr.io/cloud-builders/docker'",
    `  args: ['build', '-f', 'Dockerfile.mock', '-t', '${mockImage}', '.']`,
    'images:',
    `- '${mockImage}'`,
    'options:',
    '  logging: CLOUD_LOGGING_ONLY',
    '',
  ].join('\n'));

  await run('gcloud', [
    'builds',
    'submit',
    `--config=${mockBuildConfig}`,
    `--project=${config.projectId}`,
  ]);
}

async function deployIdpInitial() {
  await run('gcloud', [
    'run',
    'deploy',
    config.idpServiceName,
    `--image=${idpImage}`,
    '--platform=managed',
    `--region=${config.region}`,
    `--project=${config.projectId}`,
    `--service-account=${config.serviceAccount}`,
    '--allow-unauthenticated',
    '--no-invoker-iam-check',
    '--memory=512Mi',
    '--cpu=1',
    '--min-instances=0',
    '--max-instances=3',
    '--concurrency=40',
    '--cpu-boost',
    `--set-env-vars=${toEnvVars({
      APP_ENV: config.appEnv,
      APP_MODE: 'IDP',
      NODE_ENV: 'production',
      MULESOFT_ENABLE_MS4: config.mulesoftEnableMs4,
      REQUIRE_OIDC_REDIRECT: config.requireOidcRedirect,
      VITE_ALLOWED_ORIGINS: 'pending_configuration',
      CORS_ALLOWED_ORIGINS: 'pending_configuration',
      // QA token service requires these body fields to be present but empty.
      MULESOFT_OAUTH_CLIENT_ID: '',
      MULESOFT_OAUTH_CLIENT_SECRET: '',
    })}`,
    `--set-secrets=${secretMappings.join(',')}`,
  ]);
}

async function deployMockInitial(idpUrl) {
  await run('gcloud', [
    'run',
    'deploy',
    config.mockServiceName,
    `--image=${mockImage}`,
    '--platform=managed',
    `--region=${config.region}`,
    `--project=${config.projectId}`,
    '--allow-unauthenticated',
    '--no-invoker-iam-check',
    '--memory=256Mi',
    '--cpu=1',
    '--min-instances=0',
    '--max-instances=2',
    '--concurrency=40',
    '--cpu-boost',
    `--set-env-vars=${toEnvVars({
      APP_ENV: config.appEnv,
      APP_MODE: 'MOCK',
      NODE_ENV: 'production',
      VITE_IDP_URL: idpUrl,
      OIDC_CLIENT_ID: config.clientId,
      OIDC_REDIRECT_URI: 'pending_configuration',
      OIDC_RESPONSE_TYPE: config.responseType,
      OIDC_SCOPE: config.scope,
      ENV_LABEL: 'Ambiente aislado',
    })}`,
  ]);
}

async function updateMockRuntime(idpUrl, mockUrl) {
  await run('gcloud', [
    'run',
    'services',
    'update',
    config.mockServiceName,
    `--region=${config.region}`,
    `--project=${config.projectId}`,
    `--update-env-vars=${toEnvVars({
      VITE_IDP_URL: idpUrl,
      OIDC_REDIRECT_URI: mockUrl,
      MOCK_CLIENT_URL: mockUrl,
    })}`,
  ]);
}

async function updateIdpRuntime(idpUrl, mockUrl) {
  await run('gcloud', [
    'run',
    'services',
    'update',
    config.idpServiceName,
    `--region=${config.region}`,
    `--project=${config.projectId}`,
    `--update-env-vars=${toEnvVars({
      VITE_ALLOWED_ORIGINS: [mockUrl, idpUrl, 'http://localhost:3000', 'http://localhost:5173'].join('|'),
      CORS_ALLOWED_ORIGINS: [idpUrl, 'http://localhost:5173'].join('|'),
      CANONICAL_IDP_ORIGIN: idpUrl,
      VITE_IDP_URL: idpUrl,
    })}`,
  ]);
}

async function describeServiceUrl(serviceName) {
  return (await capture('gcloud', [
    'run',
    'services',
    'describe',
    serviceName,
    `--region=${config.region}`,
    `--project=${config.projectId}`,
    '--format=value(status.url)',
  ])).trim();
}

function toEnvVars(values) {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${String(value).replaceAll(',', '\\,')}`)
    .join(',');
}

async function capture(command, args) {
  if (config.dryRun) {
    console.log(`[dry-run] ${command} ${args.join(' ')}`);
    return '';
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('close', code => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with ${code}\n${stderr || stdout}`));
      }
    });
  });
}

async function run(command, args) {
  if (config.dryRun) {
    console.log(`[dry-run] ${command} ${args.join(' ')}`);
    return;
  }

  console.log(`[run] ${command} ${args.join(' ')}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with ${code}`));
    });
  });
}
