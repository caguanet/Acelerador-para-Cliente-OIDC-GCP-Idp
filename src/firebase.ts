import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const runtimeConfig = window.APP_CONFIG?.firebase;

const firebaseConfig = {
    apiKey: runtimeConfig?.apiKey || '',
    authDomain: runtimeConfig?.authDomain || '',
    projectId: runtimeConfig?.projectId || '',
};

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    throw new Error('Firebase runtime configuration is missing.');
}

// getApps() check prevents "app/duplicate-app" error on Vite HMR re-evaluation
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
auth.languageCode = 'es';
