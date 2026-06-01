# Validacion de arquitectura OTP, BFF y MS-4

Fecha de corte: 2026-05-31.

Este documento valida la arquitectura OTP actual contra el codigo vigente y consolida los diagramas necesarios para entender la diferencia entre:

- lo implementado hoy en `server/server.js`, `src/App.tsx`, `src/components/RegisterForm.tsx` y `src/components/EmailOtpLoginForm.tsx`;
- la arquitectura objetivo enterprise documentada en [IDP_MULESOFT_GCP_ARCHITECTURE.md](IDP_MULESOFT_GCP_ARCHITECTURE.md);
- las decisiones vinculantes de [ADR 0001](decisions/0001-idp-spa-stateless-bff-stateful.md).

## Veredicto ejecutivo

La arquitectura actual de OTP esta alineada con el contrato principal del repositorio: el IdP sigue siendo una SPA stateless hacia clientes OIDC y conserva OIDC Implicit Flow. El BFF existe, pero esta acotado a operaciones que no deben vivir en navegador: MuleSoft, OTP, reCAPTCHA server-side, rate limit, sesiones temporales y Firebase Admin SDK.

La implementacion vigente no corresponde aun al objetivo enterprise completo. Hoy el BFF vive dentro del mismo proceso Express que sirve la SPA, usa `Map` en memoria para sesiones OTP y solo invoca MS-4 si `MULESOFT_ENABLE_MS4=true` y hay configuracion productiva. Firestore, auditoria persistente e `idp-bff-service` modular siguen siendo evolucion objetivo.

## Documentos revisados

| Documento | Estado frente al codigo | Observacion |
| --- | --- | --- |
| [TECH_README.md](TECH_README.md) | Vigente | Describe el contrato OIDC, login por email link, Codigo OTP, prompt none y despliegue. |
| [APPLICATION_ARCHITECTURE_OVERVIEW.md](APPLICATION_ARCHITECTURE_OVERVIEW.md) | Vigente | Es la vista mas clara para explicar capas, endpoints y operacion end-to-end. |
| [LOGIN_OTP_EMAIL_FLOW.md](LOGIN_OTP_EMAIL_FLOW.md) | Vigente | Es la fuente mas precisa del login Codigo OTP implementado. |
| [IDP_MULESOFT_GCP_ARCHITECTURE.md](IDP_MULESOFT_GCP_ARCHITECTURE.md) | Vigente con distincion importante | Mezcla implementacion actual y arquitectura objetivo; la seccion inicial marca bien la diferencia. |
| [decisions/0001-idp-spa-stateless-bff-stateful.md](decisions/0001-idp-spa-stateless-bff-stateful.md) | Vigente | Mantiene la regla clave: BFF stateful acotado, sin cambiar el contrato OIDC externo. |
| [../planning/IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md](../planning/IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md) | Parcialmente historico | Sigue util para evolucion enterprise, pero varias fases ya tienen implementacion monolitica actual. |
| [../planning/HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md](../planning/HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md) | Vigente como HU de MS-4 | Debe leerse como contrato pendiente del servicio MS-4, no como descripcion exacta de todo el codigo actual. |

## Arquitectura OTP actual

```mermaid
flowchart TB
  RP["Cliente OIDC / Relying Party"] -->|"redirect OIDC<br/>client_id + redirect_uri + state"| SPA["IdP SPA<br/>React + Firebase JS SDK"]

  subgraph Browser["Navegador usuario"]
    SPA
    LOGIN["EmailOtpLoginForm.tsx<br/>Codigo OTP"]
    REG["RegisterForm.tsx<br/>Registro Hogares / MiPymes"]
  end

  subgraph CloudRun["Cloud Run idp-service<br/>Express + assets SPA"]
    CFG["GET /config.js<br/>APP_CONFIG publico"]
    BFF["server/server.js<br/>BFF acotado"]
    SESS["sessionStore Map<br/>TTL 15 min"]
    LOCK["otpLockStore<br/>Map + tmp/otp-locks.json"]
  end

  subgraph MuleSoft["MiUso / MuleSoft"]
    MS1["MS-1 Customer Lookup"]
    MS2["MS-2 Envio OTP"]
    MS3["MS-3 Validacion OTP"]
    MS4["MS-4 Alta digital<br/>pendiente / feature flag"]
  end

  subgraph GCP["Google Cloud"]
    IP["Identity Platform<br/>Firebase Auth"]
    ADMIN["Firebase Admin SDK"]
    RECAP["reCAPTCHA Enterprise"]
    SM["Secret Manager / env Cloud Run"]
  end

  SPA --> CFG
  LOGIN -->|"start-login / send / validate / complete"| BFF
  REG -->|"lookup / send / validate / register"| BFF
  BFF --> SESS
  BFF --> LOCK
  BFF --> RECAP
  BFF --> SM
  BFF --> MS1
  BFF --> MS2
  BFF --> MS3
  BFF -.->|"solo si MULESOFT_ENABLE_MS4=true"| MS4
  BFF --> ADMIN
  ADMIN --> IP
  SPA -->|"signInWithCustomToken / getIdToken"| IP
  SPA -->|"redirect_uri#id_token=..."| RP
```

## Secuencia actual de login Codigo OTP

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuario
  participant RP as Cliente OIDC
  participant SPA as IdP SPA
  participant BFF as server/server.js
  participant MS as MiUso / MuleSoft
  participant IP as Identity Platform

  RP->>SPA: Redireccion OIDC con redirect_uri autorizado
  SPA->>SPA: Valida redirect_uri contra APP_CONFIG.allowedOrigins
  U->>SPA: Selecciona Codigo OTP e ingresa correo
  SPA->>BFF: POST /api/customer/otp/start-login + recaptcha otp_send
  BFF->>IP: Admin SDK getUserByEmail
  BFF->>BFF: Valida usuario habilitado + claims ETB
  alt usuario elegible
    BFF->>MS: MS-2 envia OTP al correo de la cuenta
  else usuario no elegible o inexistente
    BFF->>BFF: Crea sesion sombra sin llamar MuleSoft
  end
  BFF-->>SPA: sessionId + maskedEmail
  U->>SPA: Ingresa OTP
  SPA->>BFF: POST /api/customer/otp/validate + recaptcha otp_validate
  alt sesion real
    BFF->>MS: MS-3 valida id_transaccion + codigo
  else sesion sombra
    BFF->>BFF: Falla indistinguible y cuenta intentos
  end
  BFF-->>SPA: verificationToken
  SPA->>BFF: POST /api/auth/login/complete
  BFF->>IP: Admin SDK createCustomToken
  BFF-->>SPA: customToken
  SPA->>IP: signInWithCustomToken
  IP-->>SPA: Firebase user + id_token
  SPA-->>RP: redirect_uri#id_token=...&state=...
```

## Secuencia actual de registro OTP y MS-4

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuario
  participant SPA as RegisterForm.tsx
  participant BFF as server/server.js
  participant MS as MuleSoft
  participant IP as Identity Platform

  U->>SPA: Ingresa datos Hogares o MiPymes
  SPA->>BFF: POST /api/customer/lookup + recaptcha lookup
  BFF->>MS: MS-1 consulta cliente y elegibilidad
  BFF-->>SPA: sessionId + maskedEmail
  SPA->>BFF: POST /api/customer/otp/send + recaptcha otp_send
  BFF->>MS: MS-2 envia OTP al correo registrado
  BFF-->>SPA: success
  U->>SPA: Ingresa codigo OTP
  SPA->>BFF: POST /api/customer/otp/validate + recaptcha otp_validate
  BFF->>MS: MS-3 valida OTP
  BFF-->>SPA: verificationToken
  U->>SPA: Define contraseña, telefono y acepta terminos
  SPA->>BFF: POST /api/customers/register
  alt MULESOFT_ENABLE_MS4=false
    BFF->>BFF: Continua sin invocar MS-4
  else MULESOFT_ENABLE_MS4=true
    alt MS-4 productivo configurado
      BFF->>MS: MS-4 registra alta digital ETB
      MS-->>BFF: OK
    else MS-4 no configurado o falla
      BFF-->>SPA: Error funcional, no crea usuario GCP
    end
  end
  BFF->>IP: Admin SDK getUserByEmail / createUser
  BFF->>IP: setCustomUserClaims + createCustomToken
  BFF-->>SPA: customToken
  SPA->>IP: signInWithCustomToken
  SPA-->>SPA: getIdToken para retorno OIDC
```

## Objetivo vs implementado hoy

| Tema | Implementado hoy | Objetivo enterprise |
| --- | --- | --- |
| Contrato OIDC externo | SPA stateless con `redirect_uri#id_token` | Igual, salvo nuevo ADR. |
| BFF | `server/server.js` en el mismo Cloud Run que sirve la SPA | Servicio modular `idp-bff-service`. |
| Sesiones OTP | `Map` en memoria con TTL 15 min | Firestore con TTL, auditoria e idempotencia. |
| Bloqueos OTP | `Map` + `tmp/otp-locks.json` | Persistencia central y trazabilidad operativa. |
| Login Codigo OTP | Implementado con MS-2/MS-3 + custom token | Mantener y endurecer operacion multi-instancia si aplica. |
| Registro OTP | Implementado con MS-1/MS-2/MS-3 + Admin SDK | Agregar MS-4 definitivo y auditoria persistente. |
| MS-4 | Feature flag `MULESOFT_ENABLE_MS4`; path provisional `/operations/v1/customer/register` | Contrato definitivo recomendado `POST /v1/digital-identity/registration`. |
| Auditoria | Logs sin PII sensible + correlation id | Firestore `accept_logs` / `registration_events`. |
| Elegibilidad | Campos fidedignos si MuleSoft los entrega; mock local en simulacion | Servicio/campo oficial aprobado por negocio, obligatorio en produccion. |

## Validacion contra codigo

| Punto validado | Evidencia en codigo |
| --- | --- |
| La SPA no llama MuleSoft directamente | `RegisterForm.tsx` y `EmailOtpLoginForm.tsx` usan `fetch('/api/...')`; MuleSoft solo aparece en `server/server.js`. |
| Login OTP usa usuario existente de Identity Platform | `/api/customer/otp/start-login` usa `admin.auth().getUserByEmail` y valida custom claims ETB. |
| Hay proteccion contra enumeracion | Login OTP crea sesiones sombra para usuarios no elegibles y responde de forma generica. |
| OTP usa MS-2 y MS-3 del lado servidor | `sendOtpViaMs2()` y `/api/customer/otp/validate` ejecutan llamadas server-side con bearer MuleSoft. |
| El cierre de login OTP es autenticacion real | `/api/auth/login/complete` emite `customToken`; la SPA ejecuta `signInWithCustomToken`. |
| Registro ya no crea usuario desde frontend | `RegisterForm.tsx` llama `/api/customers/register` y luego `signInWithCustomToken`. |
| MS-4 no esta activo por defecto | `/api/customers/register` solo invoca MS-4 si `MULESOFT_ENABLE_MS4 === 'true'`. |
| Si MS-4 esta habilitado sin configuracion valida, se bloquea | El endpoint devuelve `503` antes de crear o actualizar usuario. |
| Los secretos no se publican en `APP_CONFIG` | `/config.js` filtra patrones prohibidos antes de responder. |

## Brechas y decisiones pendientes

1. MS-4 definitivo sigue pendiente: debe confirmarse path, RAML, idempotencia, payload legal, respuesta exitosa y dueño del sistema de persistencia.
2. Produccion con alta digital previa requiere `MULESOFT_ENABLE_MS4=true` y una URL MS-4 real. Si ETB exige alta digital, no se debe ir a produccion con MS-4 apagado.
3. Firestore no esta implementado para sesiones OTP/auditoria. Para multi-instancia o evidencia fuerte, migrar `sessionStore` y eventos a almacenamiento central.
4. La elegibilidad de registro depende de un indicador fidedigno. No debe inferirse desde `services[].state.state`.
5. La HU de MS-4 conserva alcance de servicio nuevo; su narrativa debe mantenerse sincronizada con la realidad del BFF actual cuando cambie el contrato Anypoint.

## Resumen para explicar en una reunion

```mermaid
flowchart LR
  A["Cliente OIDC"] --> B["IdP SPA<br/>contrato stateless"]
  B --> C{"Metodo de acceso"}
  C -->|"Email link / social"| D["Identity Platform"]
  C -->|"Codigo OTP"| E["BFF"]
  C -->|"Registro OTP"| E
  E --> F["MuleSoft<br/>MS-1/MS-2/MS-3"]
  E -.->|"solo con flag y contrato"| G["MS-4<br/>alta digital"]
  E --> H["Admin SDK<br/>customToken"]
  H --> D
  D --> I["id_token"]
  I --> J["redirect_uri autorizado"]
```

La idea clave: OTP no cambia el contrato OIDC del producto. Agrega una puerta servidor para validar identidad ETB con MuleSoft y convertir esa validacion en una sesion real de Identity Platform.
