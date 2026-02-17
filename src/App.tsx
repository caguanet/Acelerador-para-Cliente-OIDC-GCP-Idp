import { useState, useEffect } from 'react'
import { initializeApp } from "firebase/app";
import { User } from "firebase/auth";
import './index.css'
import { LoginModal } from './components/LoginModal';


// --- Firebase Configuration ---
// Configuración dinámica (Runtime/Secrets) con fallback a entorno local (.env)
const runtimeConfig = window.APP_CONFIG?.firebase;

const firebaseConfig = {
  apiKey: runtimeConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: runtimeConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: runtimeConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID
};

// Initialize Firebase
initializeApp(firebaseConfig);


function App() {
  const [user, setUser] = useState<User | null>(null)
  
  // State for Login Modal/View
  const [showLogin, setShowLogin] = useState(false)

  // OIDC State
  const [oidcParams, setOidcParams] = useState<{
    redirect_uri: string | null,
    client_id: string | null,
    state: string | null 
  }>({ redirect_uri: null, client_id: null, state: null });
  const [oidcError, setOidcError] = useState<string | null>(null);

  // Helper for origin validation
  const isValidOrigin = (urlStr: string) => {
    try {
        const targetUrl = new URL(urlStr);
        const validationOrigins = [
            ...(window.APP_CONFIG?.allowedOrigins || [])
        ];
        // In development, allow localhost if explicitly configured or empty (fallback)
        if (import.meta.env.DEV && validationOrigins.length === 0) {
             return targetUrl.hostname === 'localhost';
        }
        return validationOrigins.some(origin => targetUrl.origin === origin);
    } catch (e) {
        return false;
    }
  };

  // On Mount: Check query params for OIDC flow OR Hash for Callback
  useEffect(() => {
    // 1. Check for OIDC Login Request
    const params = new URLSearchParams(window.location.search);
    const redirect_uri = params.get('redirect_uri');
    const client_id = params.get('client_id');
    const state = params.get('state');

    if (redirect_uri && client_id) {
        if (!isValidOrigin(redirect_uri)) {
            setOidcError(`Error de Seguridad: El dominio de redirección no está autorizado.`);
            return;
        }
        setOidcParams({ redirect_uri, client_id, state });
        setShowLogin(true); // Force login view immediately
        return;
    }


  }, []);

  const handleLoginSuccess = async (currentUser: User) => {
      setUser(currentUser)
      
      try {
        const idToken = await currentUser.getIdToken()
        
        // OIDC REDIRECT FLOW
        if (oidcParams.redirect_uri) {
            if (!isValidOrigin(oidcParams.redirect_uri)) {
                console.error("Redirect URI not allowed", oidcParams.redirect_uri);
                setOidcError(`Error de seguridad: El dominio no está autorizado para recibir credenciales.`);
                return;
            }

            const targetUrl = new URL(oidcParams.redirect_uri);
            // If valid, append token
            targetUrl.hash = `id_token=${idToken}&state=${oidcParams.state || ''}`;
            
            // Redirecting...
            window.location.href = targetUrl.toString();
            return;
        }

        // STANDALONE FLOW (No dashboard, just stay logged in)
        setShowLogin(false) // Close modal/form on success

      } catch (err) {
        console.error("Error fetching token", err)
      }
  }







  // 1. IDP Provider View (OIDC Login Page or Error)
  // This is what the user sees when redirected from the third party
  if (oidcParams.redirect_uri || oidcError) {
    return (
        <div className="app-container" style={{
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
        }}>
            <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '16px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '450px'
            }}>
                {oidcError ? (
                    <div style={{textAlign: 'center', padding: '1rem'}}>
                        <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🚫</div>
                        <h2 style={{color: '#d63031', marginBottom: '1rem'}}>Acceso No Autorizado</h2>
                        <p style={{color: '#636e72', fontSize: '0.9rem', lineHeight: '1.5'}}>
                            {oidcError}
                        </p>
                        <div style={{marginTop: '2rem'}}>
                            <button 
                                onClick={() => window.location.href = '/'}
                                style={{
                                    background: '#0984e3',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                Volver al Inicio
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <LoginModal 
                            isOpen={true} 
                            onClose={() => {}} 
                            onSignInSuccess={handleLoginSuccess}
                            isLoading={false}
                            allowClose={false}
                        />
                        <div style={{textAlign: 'center', marginTop: '1rem', color: '#666', fontSize: '0.8rem'}}>
                            <p>Solicitud de acceso para:</p>
                            <strong style={{fontSize: '1.1rem', color: '#333'}}>{oidcParams.client_id}</strong>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
  }

  // 3. Service Status View (No Dashboard)
  return (
    <div className="app-container" style={{
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        background: '#f8f9fa',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{textAlign: 'center', padding: '2rem'}}>
        <h1 style={{color: '#2d3436', marginBottom: '0.5rem'}}>Identity Provider Service</h1>
        <p style={{color: '#636e72'}}>Secure Authentication Gateway</p>
        <div style={{marginTop: '2rem', padding: '1rem', background: '#e17055', color: 'white', borderRadius: '4px', fontSize: '0.9rem'}}>
            ⚠️ Direct access restricted. Please use a valid Client App.
        </div>
        <p style={{marginTop: '2rem', fontSize: '0.8rem', color: '#b2bec3'}}>v1.0.0 • OIDC Compliant</p>
      </div>

      <LoginModal 
        isOpen={showLogin && !user}
        onClose={() => setShowLogin(false)}
        onSignInSuccess={handleLoginSuccess}
        isLoading={false} 
      />
    </div>
  )
}

export default App

