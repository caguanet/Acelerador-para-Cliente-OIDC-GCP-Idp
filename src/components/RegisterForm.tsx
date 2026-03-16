import { useState, useEffect, useRef, KeyboardEvent, ClipboardEvent, FormEvent } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

// ── Icons ─────────────────────────────────────────────────────────────────────
const EYE_ICON = (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
);
const EYE_OFF_ICON = (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);
const CALENDAR_ICON = (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);
const INFO_ICON = (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;
const OTP_EXPIRY_SECONDS = 5 * 60;
const emptyDigits = (): string[] => Array<string>(OTP_LENGTH).fill('');

type CustomerType = 'HOGARES' | 'MIPYMES';
type DocType = 'CC' | 'CE' | 'NIT' | 'TI' | 'PP';

/**
 * Hogares flow:  IDENTIFY → VERIFY → PASSWORD
 * MiPymes flow:  COMPANY  → LEGAL_REP → VERIFY  (email+pwd collected in LEGAL_REP)
 */
type RegisterStep = 'IDENTIFY' | 'COMPANY' | 'LEGAL_REP' | 'VERIFY' | 'PASSWORD';

function formatTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function checkPassword(pwd: string) {
    return {
        length: pwd.length >= 8,
        uppercase: /[A-Z]/.test(pwd),
        number: /[0-9]/.test(pwd),
        special: /[^A-Za-z0-9]/.test(pwd),
    };
}

export interface RegisterFormProps {
    onRegisterSuccess: (user: any) => void;
    onGoToLogin: () => void;
}

export function RegisterForm({ onRegisterSuccess, onGoToLogin }: RegisterFormProps) {
    const [customerType, setCustomerType] = useState<CustomerType>('HOGARES');
    const [step, setStep] = useState<RegisterStep>('IDENTIFY');

    // ── Hogares: IDENTIFY ──────────────────────────────────────────────────────
    const [docType, setDocType] = useState<DocType>('CC');
    const [docNumber, setDocNumber] = useState('');
    const [lastName, setLastName] = useState('');
    const [docExpDate, setDocExpDate] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptDataPolicy, setAcceptDataPolicy] = useState(false);
    const [recaptchaOk, setRecaptchaOk] = useState(false);
    const [identifyError, setIdentifyError] = useState('');
    const [isIdentifying, setIsIdentifying] = useState(false);

    // ── MiPymes: COMPANY ───────────────────────────────────────────────────────
    const [companyDocType, setCompanyDocType] = useState<DocType>('NIT');
    const [companyDocNumber, setCompanyDocNumber] = useState('');
    const [companyError, setCompanyError] = useState('');
    const [isLookingUp, setIsLookingUp] = useState(false);

    // ── MiPymes: LEGAL_REP ────────────────────────────────────────────────────
    const [repDocType, setRepDocType] = useState<DocType>('CC');
    const [repDocNumber, setRepDocNumber] = useState('');
    const [repExpDate, setRepExpDate] = useState('');
    const [repLastName, setRepLastName] = useState('');
    const [legalRepError, setLegalRepError] = useState('');
    const [isSubmittingRep, setIsSubmittingRep] = useState(false);

    // ── Shared: email + password (Hogares collects in PASSWORD step; MiPymes in LEGAL_REP) ──
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [keepEmail, setKeepEmail] = useState(true);

    // ── Resolved contact data (from API mock) ─────────────────────────────────
    const [maskedEmail, setMaskedEmail] = useState('');
    const [maskedPhone, setMaskedPhone] = useState('');
    const [resolvedEmail, setResolvedEmail] = useState('');

    // ── VERIFY ────────────────────────────────────────────────────────────────
    const [digits, setDigits] = useState<string[]>(emptyDigits());
    const [verifyError, setVerifyError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifySuccess, setVerifySuccess] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [expiryCountdown, setExpiryCountdown] = useState(0);
    const [isSending, setIsSending] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // ── Hogares: PASSWORD ─────────────────────────────────────────────────────
    const [passwordError, setPasswordError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    // ── Timers ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (resendCountdown <= 0) return;
        const id = setInterval(() => setResendCountdown(c => c - 1), 1000);
        return () => clearInterval(id);
    }, [resendCountdown]);

    useEffect(() => {
        if (step !== 'VERIFY' || expiryCountdown <= 0) return;
        const id = setInterval(() => setExpiryCountdown(c => c - 1), 1000);
        return () => clearInterval(id);
    }, [step, expiryCountdown]);

    // Auto-submit OTP when complete
    const isCodeComplete = digits.every(d => d !== '');
    useEffect(() => {
        if (step !== 'VERIFY' || !isCodeComplete || isVerifying || verifySuccess) return;
        handleVerifyCode();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCodeComplete, step]);

    // Auto-advance after OTP success
    useEffect(() => {
        if (!verifySuccess) return;
        const t = setTimeout(() => {
            if (customerType === 'HOGARES') {
                setEmail(resolvedEmail);
                setStep('PASSWORD');
            } else {
                // MiPymes: credentials already collected → create user
                handleCreateUserAfterOtp();
            }
        }, 1200);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verifySuccess]);

    // Switch between customer types resets steps
    const handleCustomerTypeSwitch = (type: CustomerType) => {
        setCustomerType(type);
        setStep(type === 'HOGARES' ? 'IDENTIFY' : 'COMPANY');
        setIdentifyError(''); setCompanyError(''); setLegalRepError('');
    };

    // ── Shared OTP helpers ────────────────────────────────────────────────────
    const enterVerifyStep = () => {
        setDigits(emptyDigits());
        setResendCountdown(RESEND_COOLDOWN);
        setExpiryCountdown(OTP_EXPIRY_SECONDS);
        setVerifySuccess(false);
        setVerifyError('');
        setStep('VERIFY');
    };

    // ── HOGARES: IDENTIFY ─────────────────────────────────────────────────────
    const handleIdentify = async (e: FormEvent) => {
        e.preventDefault();
        setIdentifyError('');
        if (!docNumber.trim()) { setIdentifyError('Ingresa tu número de identificación.'); return; }
        if (!lastName.trim()) { setIdentifyError('Ingresa tu apellido.'); return; }
        if (!docExpDate) { setIdentifyError('Ingresa la fecha de expedición.'); return; }
        if (!acceptTerms) { setIdentifyError('Debes aceptar los términos y condiciones.'); return; }
        if (!acceptDataPolicy) { setIdentifyError('Debes aceptar las políticas de tratamiento de datos.'); return; }
        if (!recaptchaOk) { setIdentifyError('Completa la verificación de seguridad.'); return; }
        setIsIdentifying(true);
        try {
            await new Promise(r => setTimeout(r, 800));
            setMaskedEmail('pa******@yahoo.com');
            setMaskedPhone('320****767');
            setResolvedEmail('usuario@yahoo.com');
            enterVerifyStep();
        } catch (err: any) {
            setIdentifyError(err.message || 'No fue posible verificar tu identidad. Intenta de nuevo.');
        } finally {
            setIsIdentifying(false);
        }
    };

    // ── MIPYMES: COMPANY ──────────────────────────────────────────────────────
    const handleCompanyLookup = async (e: FormEvent) => {
        e.preventDefault();
        setCompanyError('');
        if (!companyDocNumber.trim()) { setCompanyError('Ingresa el número de identificación de la empresa.'); return; }
        setIsLookingUp(true);
        try {
            await new Promise(r => setTimeout(r, 800));
            // Simulated: company found → advance to legal rep form
            setStep('LEGAL_REP');
        } catch (err: any) {
            setCompanyError(err.message || 'No se encontró la empresa. Verifica los datos.');
        } finally {
            setIsLookingUp(false);
        }
    };

    // ── MIPYMES: LEGAL_REP ────────────────────────────────────────────────────
    const handleLegalRepSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLegalRepError('');
        if (!repDocNumber.trim()) { setLegalRepError('Ingresa el número de identificación del representante legal.'); return; }
        if (!repExpDate) { setLegalRepError('Ingresa la fecha de expedición del documento.'); return; }
        if (!repLastName.trim()) { setLegalRepError('Ingresa el apellido del representante legal.'); return; }
        if (!email.trim()) { setLegalRepError('Ingresa el correo electrónico.'); return; }
        const checks = checkPassword(password);
        if (!Object.values(checks).every(Boolean)) { setLegalRepError('La contraseña no cumple todos los requisitos.'); return; }
        if (!acceptTerms) { setLegalRepError('Debes aceptar los términos y condiciones.'); return; }
        if (!acceptDataPolicy) { setLegalRepError('Debes aceptar las políticas de tratamiento de datos.'); return; }
        if (!recaptchaOk) { setLegalRepError('Completa la verificación de seguridad.'); return; }
        setIsSubmittingRep(true);
        try {
            await new Promise(r => setTimeout(r, 800));
            setMaskedEmail('pa******@yahoo.com');
            setMaskedPhone('320****767');
            setResolvedEmail(email);
            enterVerifyStep();
        } catch (err: any) {
            setLegalRepError(err.message || 'No fue posible procesar la solicitud. Intenta de nuevo.');
        } finally {
            setIsSubmittingRep(false);
        }
    };

    // ── VERIFY ────────────────────────────────────────────────────────────────
    const handleDigitChange = (index: number, value: string) => {
        const char = value.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[index] = char;
        setDigits(next);
        setVerifyError('');
        if (char && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!pasted) return;
        const next = emptyDigits();
        pasted.split('').forEach((ch, i) => { next[i] = ch; });
        setDigits(next);
        inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    };

    const handleVerifyCode = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!isCodeComplete || verifySuccess) return;
        setVerifyError('');
        setIsVerifying(true);
        try {
            await new Promise(r => setTimeout(r, 700));
            setVerifySuccess(true);
        } catch (err: any) {
            setVerifyError(err.message || 'No fue posible verificar el código. Intenta de nuevo.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (resendCountdown > 0 || isSending) return;
        setIsSending(true);
        try {
            await new Promise(r => setTimeout(r, 600));
            setDigits(emptyDigits());
            setResendCountdown(RESEND_COOLDOWN);
            setExpiryCountdown(OTP_EXPIRY_SECONDS);
            setVerifyError('');
            requestAnimationFrame(() => inputRefs.current[0]?.focus());
        } finally {
            setIsSending(false);
        }
    };

    // ── MIPYMES: create Firebase user after OTP ───────────────────────────────
    const handleCreateUserAfterOtp = async () => {
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            if (repLastName) await updateProfile(cred.user, { displayName: repLastName });
            onRegisterSuccess(cred.user);
        } catch (err: any) {
            setVerifyError(err.code === 'auth/email-already-in-use'
                ? 'Este correo ya está registrado. Inicia sesión.'
                : err.message || 'Error al crear la cuenta.');
        }
    };

    // ── HOGARES: PASSWORD ─────────────────────────────────────────────────────
    const handleCompleteRegistration = async (e: FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        if (!email.trim()) { setPasswordError('El correo electrónico es requerido.'); return; }
        if (!Object.values(checkPassword(password)).every(Boolean)) {
            setPasswordError('La contraseña no cumple todos los requisitos de seguridad.');
            return;
        }
        setIsRegistering(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            if (lastName) await updateProfile(cred.user, { displayName: lastName });
            onRegisterSuccess(cred.user);
        } catch (err: any) {
            setPasswordError(err.code === 'auth/email-already-in-use'
                ? 'Este correo ya está registrado. Inicia sesión.'
                : err.message || 'Error al crear la cuenta.');
        } finally {
            setIsRegistering(false);
        }
    };

    // ── Shared: customer type tabs (shown on IDENTIFY and COMPANY steps) ──────
    const CustomerTabs = ({ showOnStep }: { showOnStep: RegisterStep }) => (
        step === showOnStep ? (
            <div className="reg-customer-tabs" role="tablist" aria-label="Tipo de cliente">
                <button type="button" role="tab" aria-selected={customerType === 'HOGARES'}
                    className={`reg-customer-tab${customerType === 'HOGARES' ? ' reg-customer-tab--active' : ''}`}
                    onClick={() => handleCustomerTypeSwitch('HOGARES')}>Hogares</button>
                <button type="button" role="tab" aria-selected={customerType === 'MIPYMES'}
                    className={`reg-customer-tab${customerType === 'MIPYMES' ? ' reg-customer-tab--active' : ''}`}
                    onClick={() => handleCustomerTypeSwitch('MIPYMES')}>MiPymes</button>
            </div>
        ) : null
    );

    const pwdChecks = checkPassword(password);
    const allPwdOk = Object.values(pwdChecks).every(Boolean);

    // ══════════════════════════════════════════════
    // RENDER: HOGARES — IDENTIFY
    // ══════════════════════════════════════════════
    if (step === 'IDENTIFY') {
        return (
            <div className="login-form">
                <h2 className="login-form-title">Crea tu cuenta</h2>
                <p className="login-form-subtitle">Si ya eres cliente, regístrate ahora y accede a tus servicios</p>
                <CustomerTabs showOnStep="IDENTIFY" />

                <form onSubmit={handleIdentify} noValidate>
                    <div className="reg-row">
                        <div className="reg-floating-field reg-field-tipo">
                            <select id="reg-doc-type" value={docType} onChange={e => setDocType(e.target.value as DocType)}
                                className="reg-floating-select" aria-label="Tipo de documento">
                                <option value="CC">CC</option><option value="CE">CE</option>
                                <option value="NIT">NIT</option><option value="TI">TI</option><option value="PP">PP</option>
                            </select>
                            <label htmlFor="reg-doc-type" className="reg-floating-label reg-floating-label--select">Tipo</label>
                        </div>
                        <div className="reg-floating-field reg-field-num">
                            <input id="reg-doc-number" type="text" inputMode="numeric"
                                value={docNumber} onChange={e => setDocNumber(e.target.value)}
                                className={`reg-floating-input${docNumber ? ' reg-floating-input--filled' : ''}`}
                                placeholder=" " autoComplete="off" />
                            <label htmlFor="reg-doc-number" className="reg-floating-label">N° de identificación</label>
                        </div>
                    </div>

                    <div className="reg-floating-field">
                        <input id="reg-last-name" type="text"
                            value={lastName} onChange={e => setLastName(e.target.value)}
                            className={`reg-floating-input${lastName ? ' reg-floating-input--filled' : ''}`}
                            placeholder=" " autoComplete="family-name" />
                        <label htmlFor="reg-last-name" className="reg-floating-label">Apellido</label>
                    </div>

                    <div className="reg-floating-field">
                        <input id="reg-exp-date" type="text"
                            value={docExpDate} onChange={e => setDocExpDate(e.target.value)}
                            className={`reg-floating-input reg-floating-input--with-icon${docExpDate ? ' reg-floating-input--filled' : ''}`}
                            placeholder=" " autoComplete="off" />
                        <label htmlFor="reg-exp-date" className="reg-floating-label">Fecha de expedición de tu documento</label>
                        <span className="reg-field-icon">{CALENDAR_ICON}</span>
                    </div>

                    <label className="reg-checkbox-row">
                        <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} />
                        <span>Acepto los <button type="button" className="reg-link">términos y condiciones</button></span>
                    </label>
                    <label className="reg-checkbox-row">
                        <input type="checkbox" checked={acceptDataPolicy} onChange={e => setAcceptDataPolicy(e.target.checked)} />
                        <span>Acepto las <button type="button" className="reg-link">políticas de tratamiento</button> de mis datos</span>
                    </label>

                    <RecaptchaMock checked={recaptchaOk} onChange={setRecaptchaOk} />

                    {identifyError && <div className="auth-alert error" role="alert">{identifyError}</div>}

                    <button type="submit" disabled={isIdentifying} className="login-btn-primary">
                        {isIdentifying ? 'Verificando\u2026' : 'Crear cuenta'}
                    </button>
                </form>

                <button type="button" onClick={onGoToLogin} className="otp-back-link" style={{ marginTop: '0.5rem' }}>
                    Regresar al inicio
                </button>
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // RENDER: MIPYMES — COMPANY LOOKUP
    // ══════════════════════════════════════════════
    if (step === 'COMPANY') {
        return (
            <div className="login-form">
                <h2 className="login-form-title">Crea tu cuenta</h2>
                <p className="login-form-subtitle">Si ya eres cliente, regístrate ahora y accede a tus servicios</p>
                <CustomerTabs showOnStep="COMPANY" />

                <form onSubmit={handleCompanyLookup} noValidate>
                    <div className="reg-row">
                        <div className="reg-floating-field reg-field-tipo">
                            <select id="reg-company-doc-type" value={companyDocType}
                                onChange={e => setCompanyDocType(e.target.value as DocType)}
                                className="reg-floating-select" aria-label="Tipo de identificación empresa">
                                <option value="NIT">NIT</option><option value="CC">CC</option>
                                <option value="CE">CE</option><option value="TI">TI</option><option value="PP">PP</option>
                            </select>
                            <label htmlFor="reg-company-doc-type" className="reg-floating-label reg-floating-label--select">Tipo</label>
                        </div>
                        <div className="reg-floating-field reg-field-num">
                            <input id="reg-company-doc-number" type="text" inputMode="numeric"
                                value={companyDocNumber} onChange={e => setCompanyDocNumber(e.target.value)}
                                className={`reg-floating-input${companyDocNumber ? ' reg-floating-input--filled' : ''}`}
                                placeholder=" " autoComplete="off" />
                            <label htmlFor="reg-company-doc-number" className="reg-floating-label">N° de identificación de empresa</label>
                        </div>
                    </div>

                    {companyError && <div className="auth-alert error" role="alert">{companyError}</div>}

                    <button type="submit" disabled={isLookingUp || !companyDocNumber.trim()} className="login-btn-primary">
                        {isLookingUp ? 'Buscando\u2026' : 'Continuar'}
                    </button>
                </form>

                <button type="button" onClick={onGoToLogin} className="otp-back-link" style={{ marginTop: '0.5rem' }}>
                    Regresar al inicio
                </button>
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // RENDER: MIPYMES — LEGAL REP FORM
    // ══════════════════════════════════════════════
    if (step === 'LEGAL_REP') {
        return (
            <div className="login-form">
                <h2 className="login-form-title">Crea tu cuenta</h2>
                <p className="login-form-subtitle">Si ya eres cliente, regístrate ahora y accede a tus servicios</p>
                <CustomerTabs showOnStep="LEGAL_REP" />

                <form onSubmit={handleLegalRepSubmit} noValidate>
                    {/* Empresa (locked) */}
                    <div className="reg-row">
                        <div className="reg-floating-field reg-field-tipo">
                            <select disabled className="reg-floating-select reg-floating-select--disabled" aria-label="Tipo empresa">
                                <option value={companyDocType}>{companyDocType}</option>
                            </select>
                            <label className="reg-floating-label reg-floating-label--select">Tipo</label>
                        </div>
                        <div className="reg-floating-field reg-field-num">
                            <input type="text" value={companyDocNumber} disabled
                                className="reg-floating-input reg-floating-input--filled reg-floating-input--disabled"
                                placeholder=" " />
                            <label className="reg-floating-label reg-floating-label--select">N° de identificación de empresa</label>
                        </div>
                    </div>

                    {/* Representante legal doc */}
                    <div className="reg-row">
                        <div className="reg-floating-field reg-field-tipo">
                            <select id="reg-rep-doc-type" value={repDocType}
                                onChange={e => setRepDocType(e.target.value as DocType)}
                                className="reg-floating-select" aria-label="Tipo doc representante">
                                <option value="CC">CC</option><option value="CE">CE</option>
                                <option value="NIT">NIT</option><option value="TI">TI</option><option value="PP">PP</option>
                            </select>
                            <label htmlFor="reg-rep-doc-type" className="reg-floating-label reg-floating-label--select">Tipo</label>
                        </div>
                        <div className="reg-floating-field reg-field-num">
                            <input id="reg-rep-doc-number" type="text" inputMode="numeric"
                                value={repDocNumber} onChange={e => setRepDocNumber(e.target.value)}
                                className={`reg-floating-input${repDocNumber ? ' reg-floating-input--filled' : ''}`}
                                placeholder=" " autoComplete="off" />
                            <label htmlFor="reg-rep-doc-number" className="reg-floating-label">N° de identificación de representante legal</label>
                        </div>
                    </div>

                    {/* Fecha de expedición */}
                    <div className="reg-floating-field">
                        <input id="reg-rep-exp-date" type="text"
                            value={repExpDate} onChange={e => setRepExpDate(e.target.value)}
                            className={`reg-floating-input reg-floating-input--with-icon${repExpDate ? ' reg-floating-input--filled' : ''}`}
                            placeholder=" " autoComplete="off" />
                        <label htmlFor="reg-rep-exp-date" className="reg-floating-label">Fecha de expedición de tu documento</label>
                        <span className="reg-field-icon">{CALENDAR_ICON}</span>
                    </div>

                    {/* Apellido representante */}
                    <div className="reg-floating-field">
                        <input id="reg-rep-last-name" type="text"
                            value={repLastName} onChange={e => setRepLastName(e.target.value)}
                            className={`reg-floating-input${repLastName ? ' reg-floating-input--filled' : ''}`}
                            placeholder=" " autoComplete="family-name" />
                        <label htmlFor="reg-rep-last-name" className="reg-floating-label">Apellido del representante legal</label>
                    </div>

                    {/* Correo */}
                    <div className="reg-floating-field">
                        <input id="reg-rep-email" type="email"
                            value={email} onChange={e => setEmail(e.target.value)}
                            className={`reg-floating-input${email ? ' reg-floating-input--filled' : ''}`}
                            placeholder=" " autoComplete="email" />
                        <label htmlFor="reg-rep-email" className="reg-floating-label">Correo electrónico</label>
                    </div>

                    {/* Contraseña */}
                    <div className="reg-floating-field">
                        <input id="reg-rep-password" type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password" spellCheck={false}
                            value={password} onChange={e => setPassword(e.target.value)}
                            className={`reg-floating-input reg-floating-input--with-toggle${password ? ' reg-floating-input--filled' : ''}`}
                            placeholder=" " />
                        <label htmlFor="reg-rep-password" className="reg-floating-label">Contraseña</label>
                        <button type="button" className="reg-password-toggle"
                            onClick={() => setShowPassword(v => !v)}
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                            {showPassword ? EYE_OFF_ICON : EYE_ICON}
                        </button>
                    </div>

                    {/* Password requirements */}
                    <ul className="reg-pwd-requirements" aria-label="Requisitos de contraseña">
                        <li className={pwdChecks.length ? 'reg-req--ok' : ''}>Al menos 8 caracteres</li>
                        <li className={pwdChecks.uppercase ? 'reg-req--ok' : ''}>Al menos 1 mayúscula</li>
                        <li className={pwdChecks.number ? 'reg-req--ok' : ''}>Al menos 1 número</li>
                        <li className={pwdChecks.special ? 'reg-req--ok' : ''}>Al menos 1 caracter especial</li>
                    </ul>

                    {/* Terms */}
                    <label className="reg-checkbox-row">
                        <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} />
                        <span>Acepto los <button type="button" className="reg-link">términos y condiciones</button></span>
                    </label>
                    <label className="reg-checkbox-row">
                        <input type="checkbox" checked={acceptDataPolicy} onChange={e => setAcceptDataPolicy(e.target.checked)} />
                        <span>Acepto las <button type="button" className="reg-link">políticas de tratamiento</button> de mis datos</span>
                    </label>

                    <RecaptchaMock checked={recaptchaOk} onChange={setRecaptchaOk} />

                    {legalRepError && <div className="auth-alert error" role="alert">{legalRepError}</div>}

                    <button type="submit" disabled={isSubmittingRep} className="login-btn-primary">
                        {isSubmittingRep ? 'Procesando\u2026' : 'Crear cuenta'}
                    </button>
                </form>

                <button type="button" onClick={() => setStep('COMPANY')} className="otp-back-link" style={{ marginTop: '0.5rem' }}>
                    Regresar
                </button>
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // RENDER: VERIFY (both flows)
    // ══════════════════════════════════════════════
    if (step === 'VERIFY') {
        return (
            <div className="login-form">
                <h2 className="login-form-title" style={{ textAlign: 'center' }}>Verifica tu cuenta</h2>
                <p className="reg-verify-desc">
                    Te hemos enviado un código de verificación para completar tu registro<br />
                    Correo: <strong className="reg-contact-highlight">{maskedEmail}</strong><br />
                    Teléfono: <strong className="reg-contact-highlight">{maskedPhone}</strong><br />
                    Por favor, ingresa el código de {OTP_LENGTH} dígitos.
                </p>

                <form onSubmit={handleVerifyCode} noValidate>
                    <div className="otp-boxes" role="group" aria-label="Código de verificación">
                        {digits.map((digit, i) => (
                            <input key={i} ref={el => { inputRefs.current[i] = el; }}
                                type="text" inputMode="numeric" maxLength={1}
                                value={digit}
                                onChange={e => handleDigitChange(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                onPaste={i === 0 ? handlePaste : undefined}
                                className={`otp-box${digit ? ' otp-box--filled' : ''}${verifySuccess ? ' otp-box--success' : ''}`}
                                aria-label={`Dígito ${i + 1}`} autoComplete="one-time-code" readOnly={verifySuccess} />
                        ))}
                    </div>

                    {verifySuccess ? (
                        <div className="reg-verify-success" role="status">
                            <span className="reg-verify-success-icon" aria-hidden="true">✓</span>
                            <div><strong>Éxito</strong><p>Código verificado correctamente...</p></div>
                        </div>
                    ) : verifyError ? (
                        <div className="auth-alert error" role="alert">{verifyError}</div>
                    ) : null}

                    <button type="submit" disabled={!isCodeComplete || isVerifying || verifySuccess} className="login-btn-primary">
                        {isVerifying ? 'Verificando\u2026' : 'Verificar Código'}
                    </button>
                </form>

                <button type="button" onClick={handleResend} disabled={resendCountdown > 0 || isSending} className="otp-btn-secondary">
                    {isSending ? 'Reenviando\u2026' : resendCountdown > 0 ? `Reenviar en ${resendCountdown}s` : 'Reenviar Código'}
                </button>

                {expiryCountdown > 0 && !verifySuccess && (
                    <div className="reg-expiry-badge" aria-live="polite">
                        Este código expira en <strong>{formatTime(expiryCountdown)}</strong>
                    </div>
                )}

                <button type="button"
                    onClick={() => setStep(customerType === 'HOGARES' ? 'IDENTIFY' : 'LEGAL_REP')}
                    className="otp-back-link">
                    ← Volver al registro
                </button>

                <p className="reg-support-text">
                    ¿Tienes inconvenientes?<br />
                    Comunícate al <strong>601 377 7777</strong>
                </p>
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // RENDER: HOGARES — PASSWORD (final step)
    // ══════════════════════════════════════════════
    return (
        <div className="login-form">
            <form onSubmit={handleCompleteRegistration} noValidate>
                <label className="reg-checkbox-row" style={{ marginBottom: '1rem' }}>
                    <input type="checkbox" checked={keepEmail}
                        onChange={e => { setKeepEmail(e.target.checked); if (e.target.checked) setEmail(resolvedEmail); }} />
                    <span>Conservar correo registrado</span>
                </label>

                <div className="reg-floating-field">
                    <input id="reg-final-email" type="email"
                        value={email} onChange={e => { if (!keepEmail) setEmail(e.target.value); }}
                        disabled={keepEmail}
                        className={`reg-floating-input${email ? ' reg-floating-input--filled' : ''}${keepEmail ? ' reg-floating-input--disabled' : ''}`}
                        placeholder=" " autoComplete="email" />
                    <label htmlFor="reg-final-email" className="reg-floating-label">Correo</label>
                </div>

                <div className="reg-floating-field">
                    <input id="reg-final-password" type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password" spellCheck={false}
                        value={password} onChange={e => setPassword(e.target.value)}
                        className={`reg-floating-input reg-floating-input--with-toggle${password ? ' reg-floating-input--filled' : ''}`}
                        placeholder=" " />
                    <label htmlFor="reg-final-password" className="reg-floating-label">Contraseña</label>
                    <button type="button" className="reg-password-toggle"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        {showPassword ? EYE_OFF_ICON : EYE_ICON}
                    </button>
                </div>

                <ul className="reg-pwd-requirements" aria-label="Requisitos de contraseña">
                    <li className={pwdChecks.length ? 'reg-req--ok' : ''}>Al menos 8 caracteres</li>
                    <li className={pwdChecks.uppercase ? 'reg-req--ok' : ''}>Al menos 1 mayúscula</li>
                    <li className={pwdChecks.number ? 'reg-req--ok' : ''}>Al menos 1 número</li>
                    <li className={pwdChecks.special ? 'reg-req--ok' : ''}>Al menos 1 caracter especial</li>
                </ul>

                <div className="reg-info-box">
                    {INFO_ICON}
                    <p>Esta contraseña te permitirá acceder a servicios de entretenimiento como plataformas OTT y disfrutar de nuestro servicio de Chat de Luz cuando lo necesites.</p>
                </div>

                {passwordError && <div className="auth-alert error" role="alert">{passwordError}</div>}

                <button type="submit" disabled={isRegistering || !allPwdOk || !email.trim()} className="login-btn-primary">
                    {isRegistering ? 'Registrando\u2026' : 'Completar registro'}
                </button>
            </form>
        </div>
    );
}

// ── Shared reCAPTCHA mock ─────────────────────────────────────────────────────
function RecaptchaMock({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="otp-recaptcha-area">
            <div className="otp-recaptcha-mock">
                <label className="otp-recaptcha-check">
                    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label="Verificación de seguridad" />
                    <span>No soy un robot</span>
                </label>
                <div className="otp-recaptcha-badge">
                    <svg aria-hidden="true" width="32" height="32" viewBox="0 0 64 64" fill="none">
                        <path d="M32 4L56 18V46L32 60L8 46V18L32 4Z" fill="#4A90D9" opacity="0.15" stroke="#4A90D9" strokeWidth="2" />
                        <path d="M32 14L48 23V41L32 50L16 41V23L32 14Z" fill="#4A90D9" opacity="0.3" />
                    </svg>
                    <div className="otp-recaptcha-brand"><span>reCAPTCHA</span><small>Privacidad · Términos</small></div>
                </div>
            </div>
        </div>
    );
}
