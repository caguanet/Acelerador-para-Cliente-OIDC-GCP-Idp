import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const runtimeConfig = window.APP_CONFIG?.firebase;

const firebaseConfig = {
    apiKey: runtimeConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: runtimeConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: runtimeConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

// getApps() check prevents "app/duplicate-app" error on Vite HMR re-evaluation
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
