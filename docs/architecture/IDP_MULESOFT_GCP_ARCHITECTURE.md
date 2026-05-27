# Arquitectura IdP GCP + MuleSoft + OTP ETB

Fecha de corte: 2026-05-25.

Este documento define la arquitectura objetivo para integrar el IdP SPA del repo con GCP Identity Platform y los servicios MuleSoft existentes de ETB. Complementa `docs/architecture/TECH_README.md` y mantiene la decisión actual del producto: IdP SPA stateless con OIDC Implicit Flow hacia los clientes OIDC.

Decision formal: [ADR 0001 - IdP SPA Stateless + BFF Stateful Acotado](decisions/0001-idp-spa-stateless-bff-stateful.md). El BFF es stateful solo para MuleSoft, OTP, MS-4, auditoria y Admin SDK; no reemplaza el contrato OIDC stateless del IdP hacia los Relying Parties.

Manual operativo y despliegue: [docs/guides/IDP_GCP_MULESOFT_MANUAL.md](../guides/IDP_GCP_MULESOFT_MANUAL.md). Plan por fases (BFF modular futuro): [docs/planning/IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md](../planning/IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md).

## Implementación actual en el repositorio

Esta sección describe **lo que está implementado hoy en código**, no solo el diseño objetivo. El proxy MuleSoft vive en el mismo proceso Express que sirve el build del IdP (`server/server.js`, puerto `8080` en Cloud Run). No existe aún el árbol modular `idp-bff-service` del plan de fases; esa estructura sigue siendo objetivo.

### Resumen

| Capa | Ubicación | Rol |
| --- | --- | --- |
| IdP SPA (login OIDC) | `src/App.tsx`, `src/components/PasswordlessLoginForm.tsx` | OIDC Implicit, Firebase Auth; **no llama MuleSoft** |
| Registro ETB (OTP) | `src/components/RegisterForm.tsx` | Orquesta el flujo vía `fetch` al BFF |
| BFF / proxy MuleSoft | `server/server.js` | MS-1…MS-4, sesión, rate limit, reCAPTCHA, Firebase Admin SDK |
| Config runtime | `GET /config.js` en `server/server.js` | Inyecta `window.APP_CONFIG` sin secretos MuleSoft |

La sesión de registro (`sessionId`) se guarda en un **`Map` en memoria** con TTL de 15 minutos. El diseño objetivo prevé **Firestore** (`otp_sessions`); eso aún no está implementado.

### Arquitectura implementada (vista de componentes)

```mermaid
flowchart TB
    subgraph Cliente["Navegador"]
        SPA["IdP SPA — src/App.tsx<br/>Login OIDC + silent refresh"]
        REG["RegisterForm.tsx<br/>Hogares / MiPymes"]
    end

    subgraph BFF["BFF — server/server.js"]
        CFG["GET /config.js"]
        L1["POST /api/customer/lookup → MS-1"]
        L2["POST /api/customer/otp/send → MS-2"]
        L3["POST /api/customer/otp/validate → MS-3"]
        L4["POST /api/customers/register → MS-4 + Admin SDK"]
        SESS["sessionStore Map en memoria<br/>email enmascarado al cliente"]
        TOK["getMuleSoftBearerToken()"]
    end

    subgraph MuleSoft["MuleSoft CloudHub"]
        MS1["MS-1 GET /v1/customer"]
        MS2["MS-2 POST .../customer/otp"]
        MS3["MS-3 POST .../otp/validation"]
        MS4["MS-4 POST .../customer/register<br/>contrato Anypoint pendiente"]
    end

    subgraph GCP["GCP"]
        FB["Firebase Auth / Identity Platform"]
        SM["Secret Manager / env del servicio"]
    end

    SPA -->|"signIn / getIdToken"| FB
    REG --> L1 & L2 & L3 & L4
    L1 & L2 & L3 & L4 --> SESS
    L1 & L2 & L3 & L4 --> TOK
    TOK --> SM
    L1 --> MS1
    L2 --> MS2
    L3 --> MS3
    L4 --> MS4
    L4 -->|"createUser + customToken"| FB
```

### Mapa código ↔ servicio MuleSoft

| Paso | Servicio | Endpoint BFF (implementado) | Archivo / función |
| --- | --- | --- | --- |
| 1 | MS-1 consulta cliente | `POST /api/customer/lookup` | `server/server.js` — handler ~línea 377 |
| 2 | MS-2 envío OTP | `POST /api/customer/otp/send` | `server/server.js` — handler ~línea 530 |
| 3 | MS-3 validación OTP | `POST /api/customer/otp/validate` | `server/server.js` — handler ~línea 610 |
| 4 | MS-4 + Identity Platform | `POST /api/customers/register` | `server/server.js` — handler ~línea 703 |
| UI registro | — | `fetch('/api/...')` | `src/components/RegisterForm.tsx` |
| Token OAuth MuleSoft | — | `getMuleSoftBearerToken()` | `server/server.js` — ~línea 269 |
| Path MS-3 (normalización URL) | — | `getMulesoftOtpValidationPath()` | `server/server.js` — ~línea 178 |
| Elegibilidad MS-1 | — | `getReliableRegistrationEligibility()` | `server/server.js` — ~línea 192 |

### Secuencia de registro (implementación actual)

Los nombres de ruta BFF difieren del diseño objetivo documentado más abajo (`/api/customers/lookup` vs `/api/customer/lookup`). Esta secuencia refleja el código vigente.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant UI as RegisterForm.tsx
    participant BFF as server/server.js
    participant MS as MuleSoft
    participant GCP as Firebase Admin SDK

    U->>UI: Documento (+ NIT/rep. legal si MiPymes)
    UI->>BFF: POST /api/customer/lookup + reCAPTCHA
    BFF->>BFF: rate limit + correlationId + sessionId (Map)
    BFF->>MS: OAuth token + MS-1 GET /v1/customer
    MS-->>BFF: contactData.email + elegibilidad
    BFF-->>UI: sessionId + maskedEmail

    UI->>BFF: POST /api/customer/otp/send
    BFF->>MS: OAuth token + MS-2 POST OTP (correo de sesión)
    MS-->>BFF: id_transaccion
    BFF-->>UI: success

    U->>UI: Código 6 dígitos
    UI->>BFF: POST /api/customer/otp/validate
    BFF->>MS: OAuth token + MS-3 POST validación
    BFF-->>UI: verificationToken (un solo uso, TTL 10 min)

    U->>UI: Contraseña + teléfono + términos
    UI->>BFF: POST /api/customers/register
    opt MULESOFT_ENABLE_MS4=true y MS-4 configurado
        BFF->>MS: OAuth token + MS-4 POST /operations/v1/customer/register
    end
    BFF->>GCP: createUser + setCustomUserClaims
    GCP-->>BFF: customToken
    BFF-->>UI: customToken
    UI->>GCP: signInWithCustomToken → id_token OIDC
```

### Login OIDC (sin MuleSoft)

El login principal y el silent refresh (`prompt=none`) usan solo Firebase desde la SPA. MuleSoft participa únicamente en **registro / alta digital ETB**.

```mermaid
sequenceDiagram
    actor App as Cliente OIDC
    participant IdP as App.tsx
    participant FB as Firebase Auth

    App->>IdP: ?client_id&redirect_uri&response_type=id_token
    IdP->>IdP: Valida redirect_uri (APP_CONFIG)
    alt prompt=none
        IdP->>FB: getIdToken(true) si hay sesión
    else login normal
        U->>IdP: Email link / contraseña / social
        IdP->>FB: signIn*
    end
    FB-->>IdP: id_token
    IdP->>App: redirect_uri#id_token=...&state=...
```

### Variables de entorno del BFF (servidor)

No deben exponerse en `public/config.js` ni en el navegador.

| Variable | Uso |
| --- | --- |
| `MULESOFT_BASE_URL_MS1` | Base URL MS-1 (`GET /v1/customer`) |
| `MULESOFT_BASE_URL_MS2` | Base URL MS-2 (envío OTP) |
| `MULESOFT_BASE_URL_MS3` | Base URL MS-3 (validación OTP) |
| `MULESOFT_ENABLE_MS4` | Feature flag para invocar MS-4; `false` por defecto en la fase actual |
| `MULESOFT_BASE_URL_MS4` | Base URL MS-4 (alta digital; pendiente de contrato productivo) |
| `MULESOFT_CLIENT_ID` / `MULESOFT_CLIENT_SECRET` | Headers/credenciales hacia CloudHub |
| `MULESOFT_OAUTH_URL` | OAuth `client_credentials` para bearer dinámico |
| `MULESOFT_OAUTH_CLIENT_ID` / `MULESOFT_OAUTH_CLIENT_SECRET` / `MULESOFT_OAUTH_ACCOUNT_ID` | Credenciales del body para el servicio ETB OAuth 2.0 |
| `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_CONFIG` | Firebase Admin SDK local; en Cloud Run se usan Application Default Credentials de la service account |
| `RECAPTCHA_*` | Verificación antes de lookup y envío OTP |
| `VITE_ALLOWED_ORIGINS` | Origenes permitidos para `redirect_uri` OIDC; se publica en `/config.js` |
| `CORS_ALLOWED_ORIGINS` | Origenes permitidos para llamadas browser al BFF y guard server-side de rutas sensibles |

Detalle operativo y valores QA: [IDP_GCP_MULESOFT_MANUAL.md](../guides/IDP_GCP_MULESOFT_MANUAL.md).

Reglas transversales MuleSoft:

- Cada llamada a MS-1/MS-2/MS-3 y futuro MS-4 solicita un token nuevo al servicio `MULESOFT_OAUTH_URL`.
- Si `MULESOFT_OAUTH_CLIENT_ID` o `MULESOFT_OAUTH_CLIENT_SECRET` existen con valor vacio, el BFF envia esos campos vacios en el body del token service. El fallback a `MULESOFT_CLIENT_ID` / `MULESOFT_CLIENT_SECRET` aplica solo cuando la variable OAuth no existe.
- Los headers `name` y `source` viajan siempre con valor `IDP-MiETB`.
- `X-CORRELATION-ID` se genera una sola vez al iniciar la sesion de registro y se conserva para token service, MS-1, MS-2, MS-3 y futuro MS-4.

Reglas transversales de origen:

- Las rutas sensibles de registro validan `Origin` o `Referer` contra `CORS_ALLOWED_ORIGINS` en el servidor.
- Este control complementa CORS, reCAPTCHA y rate limit porque Cloud Run es publico y CORS no bloquea clientes server-to-server.

### Modo mock vs llamadas reales

```mermaid
flowchart LR
    A["¿MULESOFT_BASE_URL_MS*<br/>y MULESOFT_CLIENT_ID definidos?"] -->|No| B["Mock: email ficticio,<br/>OTP 123456 o 654321"]
    A -->|Sí| C["Llamadas reales CloudHub"]
    C --> D{"¿MULESOFT_ENABLE_MS4=true?"}
    D -->|No| E["Registro solo Firebase<br/>sin MS-4"]
    D -->|Sí| F["Exigir MULESOFT_BASE_URL_MS4<br/>y ejecutar MS-4 antes de createUser"]
```

Condición en código: `isMockMode` cuando falta URL, la URL contiene `mock`, o no hay `MULESOFT_CLIENT_ID`.

### Detalle de integración MuleSoft en `server/server.js`

| MS | Método y path hacia MuleSoft | Notas de implementación |
| --- | --- | --- |
| MS-1 | `GET {MS1}/v1/customer?ORIGIN=TELECENTER&CUSTOMER_ID=...&CUSTOMER_ID_TYPE=...` | MiPymes añade `COMPANY_ID` / `COMPANY_ID_TYPE`. Headers: `systemId: MIGRACION`, `name`/`source: IDP-MiETB`, `client_id`, `client_secret`, `Authorization` |
| MS-2 | `POST {MS2}/operations/v1/customer/otp` | Body: `aplicacion: IDP-MiETB`, canal `EMAIL`, `valor_canal` = correo de sesión (no elegido por usuario) |
| MS-3 | `POST` vía `getMulesoftOtpValidationPath(base)` | Soporta variantes de base URL (`v1customer` vs `v1/customer`) |
| MS-4 | `POST {MS4}/operations/v1/customer/register` | Path **provisional** en repo; contrato definitivo pendiente en Anypoint — ver [HU-MS4](../planning/HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md) |

Elegibilidad en código (hasta indicador fidedigno de negocio): `eligibleForDigitalRegistration`, `hasActiveServices`, o `registrationEligibility.status === "ELIGIBLE"`.

Claims tras registro (`setCustomUserClaims`): `customerType`, `documentHash`, `registration_source: mulesoft_otp`, `auth_level: otp_verified`; MiPymes añade `companyDocumentHash`.

### Brecha: objetivo vs implementado

| Tema | Objetivo (este doc / plan) | Implementado hoy |
| --- | --- | --- |
| Proyecto BFF | `idp-bff-service` TypeScript modular | Monolito `server/server.js` |
| Sesión OTP | Firestore `otp_sessions` | `Map` en memoria |
| Rutas BFF registro | `/api/customers/lookup`, `/api/otp/send`, `/api/otp/verify` | `/api/customer/lookup`, `/api/customer/otp/send`, `/api/customer/otp/validate` |
| Headers MuleSoft `name`/`source`/`aplicacion` | `IDP-MiETB` | Implementado en `server/server.js` |
| MS-4 | Contrato `POST /v1/digital-identity/registration` (recomendado) | `POST /operations/v1/customer/register` provisional |
| Health check BFF | `GET /healthz` | `GET /api/health` |
| Auditoría | Firestore `accept_logs` | No persistido en servidor actual |

## Mapa Visual Rápido

```mermaid
flowchart LR
  A[Usuario inicia registro o login] --> B[IdP SPA<br/>React]
  B --> C[BFF Cloud Run]
  C --> D[MS-1<br/>consulta cliente]
  D --> E{MuleSoft confirma<br/>elegibilidad?}
  E -- No --> F[Bloquear registro<br/>mensaje funcional]
  E -- Sí --> G[MS-2<br/>enviar OTP]
  G --> H[MS-3<br/>validar OTP]
  H --> I{OTP válido?}
  I -- No --> J[Reintentar / bloquear<br/>por intentos]
  I -- Sí --> K[MS-4<br/>registro digital ETB]
  K --> L{MS-4 OK?}
  L -- No --> M[No crear usuario GCP]
  L -- Sí --> N[Identity Platform<br/>crear usuario + claims]
  N --> O[Custom token]
  O --> P[IdP emite id_token OIDC<br/>al cliente]
```

## Decisión De Elegibilidad Pendiente

No usar `customer.services[].state.state` como fuente de verdad para decidir si el cliente tiene servicios activos. Ese dato no es fidedigno para el registro.

La elegibilidad debe venir de MuleSoft mediante un campo o servicio explícito, por ejemplo:

- `eligibleForDigitalRegistration: true`
- `hasActiveServices: true`
- `registrationEligibility.status: "ELIGIBLE"`
- o un MS dedicado de elegibilidad/registro validado por negocio.

Notas:

- No se usa `customer.state === "ACTIVO"` como condición bloqueante de elegibilidad.
- No se usa `services[].state.state === "Activo"` como condición bloqueante ni habilitante.
- Hasta que MuleSoft entregue un indicador fidedigno, el BFF no debe crear usuario en Identity Platform en producción.
- El correo de OTP debe salir de `customer.contactData.email` entregado por MuleSoft. En producción el usuario no debe poder elegir otro correo para recibir OTP.

### Diagrama De Decisión

```mermaid
flowchart TD
  START([Respuesta MS-1]) --> A{customer[] tiene<br/>al menos un cliente?}
  A -- No --> NOCLIENTE[No encontrado<br/>bloquear]
  A -- Sí --> B{contactData.email<br/>existe?}
  B -- No --> NOCORREO[Sin correo registrado<br/>bloquear]
  B -- Sí --> C{Campo fidedigno<br/>de elegibilidad?}
  C -- No --> PENDIENTE[Contrato MuleSoft pendiente<br/>no inferir desde services]
  C -- Sí --> D{Elegible?}
  D -- No --> NOACTIVO[No elegible<br/>bloquear]
  D -- Sí --> OK[Elegible<br/>continuar OTP]
```

## Decisión MiPymes

Para MiPymes la validación se realiza con NIT de empresa y representante legal:

- La UI captura `NIT` de empresa y tipo/número de documento del representante legal antes de solicitar OTP.
- El BFF envía a MS-1 el documento del representante legal como identidad principal (`CUSTOMER_ID_TYPE` y `CUSTOMER_ID`) y adjunta el NIT de empresa como dato de validación/auditoría según el contrato MuleSoft vigente.
- La elegibilidad se evalúa con el indicador fidedigno que MuleSoft defina; no se infiere desde `services[].state.state`.
- El NIT y el documento del representante quedan congelados en la sesión del BFF. Después de OTP no se permite cambiarlos ni registrar con valores reenviados desde el navegador.
- Los claims deben distinguir el segmento con `customer_type: "MiPymes"` cuando MS-1 retorne ese segmento o cuando la ruta UI seleccionada sea MiPymes y el BFF lo confirme.

## Servicios Existentes

| Servicio | Endpoint QA | Uso |
| --- | --- | --- |
| MS-1 consulta cliente | `GET https://customer-xapi-services-QA.us-e2.cloudhub.io:443/v1/customer` | Retorna `customer[]`, datos de contacto, `segment` y `services[]`. |
| MS-2 genera/envía OTP | `POST https://mule-worker-internal-experience-xapi-services-QA.us-e2.cloudhub.io:8082/operations/v1/customer/otp` | Envía OTP al correo registrado y retorna `id_transaccion`. |
| MS-3 valida OTP | `POST https://experience-xapi-services-QA.us-e2.cloudhub.io:443/operations/v1/customer/otp/validation` | Valida `id_transaccion` + código OTP. |
| MS-4 registra cliente digital | Pendiente de definición MuleSoft | Debe registrar la aceptación/alta digital en sistemas ETB antes de crear o habilitar el usuario en Identity Platform. |

Los secretos MuleSoft (`client_id`, `client_secret`, bearer JWT) deben vivir en Secret Manager. No deben viajar al navegador ni a `public/config.js`.

## Servicio Pendiente MS-4

MS-4 es bloqueante para producción si ETB necesita registrar al cliente en sistemas internos antes de crear la identidad GCP. El orden correcto es:

1. MS-1 o un servicio equivalente retorna un indicador fidedigno de elegibilidad.
2. MS-2 envía OTP al correo registrado.
3. MS-3 valida OTP.
4. MS-4 registra el alta digital/cliente en ETB.
5. BFF crea/actualiza el usuario en Identity Platform.
6. BFF emite custom token para que el IdP complete el OIDC redirect.

Contrato recomendado para MS-4:

```json
{
  "aplicacion": "silice",
  "id_transaccion_otp": "<id_transaccion de MS-2>",
  "tipo_cliente": "HOGARES|MIPYMES",
  "tipo_documento": "CC",
  "numero_documento": "9774689",
  "correo_registrado": "cliente@dominio.com",
  "acepta_terminos": true,
  "version_terminos": "v1.0",
  "acepta_tratamiento_datos": true,
  "version_tratamiento_datos": "v1.0",
  "proveedor_identidad": "GCP_IDENTITY_PLATFORM",
  "correlation_id": "BFF-..."
}
```

Respuesta recomendada:

```json
{
  "codigo": "200",
  "id_registro": "REG-...",
  "estado": "REGISTRADO"
}
```

Si MS-4 falla, el BFF no debe crear el usuario en Identity Platform. Si ya existía un usuario previo, no debe emitir custom token hasta resolver el estado ETB.

### Posición De MS-4 En El Camino Crítico

```mermaid
flowchart LR
  MS1[MS-1<br/>elegibilidad fidedigna] --> MS2[MS-2<br/>envía OTP]
  MS2 --> MS3[MS-3<br/>valida OTP]
  MS3 --> MS4[MS-4<br/>registra alta ETB]
  MS4 --> GCP[Identity Platform<br/>createUser / updateUser]
  GCP --> TOKEN[Custom token]

  MS4 -. falla .-> STOP[Detener flujo<br/>no crear identidad]
```

## Componentes Objetivo

```mermaid
graph TB
  User((Usuario))
  Partner[Cliente OIDC / Relying Party]

  subgraph GCP["GCP - Proyecto Identity"]
    LB[HTTPS Load Balancer / Cloud Armor opcional]
    IdP[Cloud Run idp-service<br/>React SPA + Firebase JS SDK]
    BFF[Cloud Run idp-bff-service<br/>Node + Express + Firebase Admin SDK]
    IP[Identity Platform<br/>Email/Password + Google + Apple + Facebook]
    SM[Secret Manager]
    FS[(Firestore<br/>otp_sessions + accept_logs)]
    RE[reCAPTCHA Enterprise]
    VPC[Serverless VPC Access / Cloud NAT / VPN si aplica]
  end

  subgraph MuleSoft["Anypoint / CloudHub"]
    MS1[MS-1 Customer Lookup]
    MS2[MS-2 OTP Send]
    MS3[MS-3 OTP Validate]
    MS4[MS-4 Digital Registration]
  end

  Partner -->|OIDC redirect| LB
  User --> LB
  LB --> IdP
  IdP -->|fetch /api/*| BFF
  IdP -->|signInWithPopup / signInWithCustomToken| IP
  BFF --> SM
  BFF --> FS
  BFF --> RE
  BFF -->|Admin SDK createUser / claims / customToken| IP
  BFF --> VPC
  VPC --> MS1
  VPC --> MS2
  VPC --> MS3
  VPC --> MS4
```

## Límites De Confianza

```mermaid
flowchart TB
  subgraph Browser["Navegador usuario - no confiable"]
    SPA[IdP SPA<br/>sin secretos]
  end

  subgraph PublicGCP["GCP público controlado"]
    CRIDP[Cloud Run idp-service]
    CRBFF[Cloud Run idp-bff-service]
    WAF[Cloud Armor / HTTPS LB]
  end

  subgraph SecureGCP["GCP seguro"]
    SEC[Secret Manager]
    FIRE[(Firestore)]
    IDP[Identity Platform]
    RECAP[reCAPTCHA Enterprise]
  end

  subgraph ETB["MuleSoft / Sistemas ETB"]
    M1[MS-1]
    M2[MS-2]
    M3[MS-3]
    M4[MS-4]
  end

  SPA -->|solo datos usuario + tokens públicos| WAF
  WAF --> CRIDP
  CRIDP -->|API HTTPS + reCAPTCHA| CRBFF
  CRBFF --> SEC
  CRBFF --> FIRE
  CRBFF --> RECAP
  CRBFF --> IDP
  CRBFF -->|credenciales solo servidor| M1
  CRBFF --> M2
  CRBFF --> M3
  CRBFF --> M4
```

## Estados Del Registro

```mermaid
stateDiagram-v2
  [*] --> INITIATED: MS-1 elegible
  INITIATED --> OTP_SENT: MS-2 envía OTP
  OTP_SENT --> OTP_SENT: reenvío permitido
  OTP_SENT --> OTP_VERIFIED: MS-3 codigo 200
  OTP_SENT --> BLOCKED: demasiados intentos
  OTP_SENT --> EXPIRED: TTL vencido
  OTP_VERIFIED --> ETB_REGISTERED: MS-4 OK
  OTP_VERIFIED --> REGISTRATION_FAILED: MS-4 falla
  ETB_REGISTERED --> IDP_CREATED: Identity Platform createUser/updateUser
  IDP_CREATED --> AUTHENTICATED: signInWithCustomToken
  AUTHENTICATED --> [*]
  BLOCKED --> [*]
  EXPIRED --> [*]
  REGISTRATION_FAILED --> [*]
```

## Flujo Registro Hogares

> **Nota:** Los diagramas de esta sección y la de MiPymes describen el **flujo objetivo** (Firestore, rutas `/api/customers/*` y `/api/otp/*`). Para rutas, archivos y secuencia **implementados hoy**, ver [Implementación actual en el repositorio](#implementación-actual-en-el-repositorio).

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuario
  participant SPA as IdP SPA
  participant BFF as BFF
  participant MS as MuleSoft
  participant IP as Identity Platform
  participant FS as Firestore

  U->>SPA: Ingresa documento y datos solicitados
  SPA->>BFF: POST /api/customers/lookup
  BFF->>MS: MS-1 GET /v1/customer
  MS-->>BFF: customer[] + elegibilidad fidedigna
  BFF->>BFF: valida indicador MuleSoft
  BFF->>FS: crea otp_session INITIATED
  BFF-->>SPA: bffSessionId + maskedEmail + segment

  U->>SPA: Solicita OTP
  SPA->>BFF: POST /api/otp/send
  BFF->>MS: MS-2 POST OTP al contactData.email
  MS-->>BFF: id_transaccion
  BFF->>FS: guarda id_transaccion y cooldown
  BFF-->>SPA: OTP enviado

  U->>SPA: Ingresa OTP
  SPA->>BFF: POST /api/otp/verify
  BFF->>MS: MS-3 POST validation
  MS-->>BFF: codigo 200
  BFF->>FS: marca OTP_VERIFIED
  BFF-->>SPA: verificationToken

  U->>SPA: Define contraseña y acepta términos
  SPA->>BFF: POST /api/customers/register
  BFF->>MS: MS-4 registra alta digital ETB
  MS-->>BFF: codigo 200 + id_registro
  BFF->>IP: createUser(email, password, emailVerified=true)
  BFF->>IP: setCustomUserClaims(uid, claims ETB)
  BFF->>FS: guarda accept_logs
  BFF->>IP: createCustomToken(uid)
  BFF-->>SPA: customToken
  SPA->>IP: signInWithCustomToken
  SPA->>SPA: getIdToken(true)
  SPA-->>Partner: redirect_uri#id_token=...
```

## Flujo Registro MiPymes Por Representante Legal

```mermaid
sequenceDiagram
  autonumber
  participant U as Representante legal
  participant SPA as IdP SPA
  participant BFF as BFF
  participant MS as MuleSoft
  participant IP as Identity Platform

  U->>SPA: Ingresa NIT de empresa y documento del representante legal
  SPA->>BFF: POST /api/customers/lookup<br/>{flow:"MIPYMES", companyDocType:"NIT", companyDocNumber, repDocType, repDocNumber}
  BFF->>MS: MS-1 GET /v1/customer<br/>CUSTOMER_ID=repDocNumber + NIT empresa
  MS-->>BFF: customer[] + elegibilidad fidedigna + contactData.email
  BFF->>BFF: valida indicador MuleSoft
  BFF-->>SPA: bffSessionId + maskedEmail
  SPA->>BFF: POST /api/otp/send
  BFF->>MS: MS-2 OTP al correo registrado del representante
  SPA->>BFF: POST /api/otp/verify
  BFF->>MS: MS-3 valida OTP
  SPA->>BFF: POST /api/customers/register
  BFF->>MS: MS-4 registra alta digital MiPymes
  BFF->>IP: createUser + customClaims MiPymes
  BFF-->>SPA: customToken
```

## Flujo Social Login Controlado

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuario
  participant SPA as IdP SPA
  participant IP as Identity Platform
  participant BF as Blocking Function
  participant BFF as BFF

  U->>SPA: Click Google / Apple / Facebook
  SPA->>IP: signInWithPopup(provider)
  IP->>BF: beforeCreate / beforeSignIn
  BF->>BF: valida si usuario ya tiene claim ETB<br/>o vinculación aprobada
  alt usuario validado ETB
    BF-->>IP: allow
    IP-->>SPA: user credential
    SPA->>SPA: getIdToken(true)
  else usuario social nuevo sin validación ETB
    BF-->>IP: deny
    IP-->>SPA: error controlado
    SPA->>BFF: opcional iniciar flujo registro ETB
  end
```

## Flujo Login Email Link

El login principal de la pantalla IdP usa funcionalidades de GCP Identity Platform/Firebase Auth. MuleSoft MS-2/MS-3 queda para validacion ETB de registro/alta digital, no para autenticar usuarios existentes desde esta pantalla.

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuario
  participant SPA as IdP SPA
  participant IP as Identity Platform

  U->>SPA: Ingresa correo
  SPA->>IP: sendSignInLinkToEmail(email)
  IP-->>U: Envia enlace de acceso por correo
  U->>SPA: Abre enlace de acceso
  SPA->>IP: signInWithEmailLink(email, link)
  IP-->>SPA: Firebase user
  SPA->>SPA: getIdToken(true)
  SPA-->>Partner: redirect_uri#id_token=...
```

## Recuperación De Contraseña Administrada Por GCP

La recuperación de contraseña se mantiene en Identity Platform para usuarios con proveedor Email/Password:

- Decisión MVP: el IdP solicita el reset con Firebase JS SDK (`sendPasswordResetEmail`).
- GCP genera el action code seguro.
- El usuario recibe un enlace de recuperación.
- El enlace abre el handler autorizado de Identity Platform, por ejemplo `https://<IDP_DOMAIN>/__/auth/action`.
- El usuario define nueva contraseña y luego vuelve al IdP para autenticarse.

La opción enterprise con BFF/Admin SDK (`generatePasswordResetLink`) queda como alternativa futura si Seguridad/Operación exige auditoría central, rate limit server-side o envío de correo corporativo ETB.

Los dominios QA/PROD del IdP y del BFF aún no están definidos. Para QA pueden usarse temporalmente las URLs públicas de Cloud Run; para PROD deben existir dominios corporativos confirmados antes de configurar providers sociales, authorized domains, CORS, reCAPTCHA y pruebas E2E productivas.

### Diagrama Recuperación MVP

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuario
  participant SPA as IdP SPA
  participant IP as Identity Platform
  participant MAIL as Correo

  U->>SPA: Solicita recuperar contraseña
  SPA->>IP: sendPasswordResetEmail(email)
  IP->>MAIL: envía link con action code
  SPA-->>U: Mensaje genérico<br/>si existe, enviaremos instrucciones
  U->>IP: Abre link autorizado
  IP-->>U: Formulario cambio contraseña
  U->>IP: Define nueva contraseña
  IP-->>U: Contraseña actualizada
```

### Diagrama Recuperación Enterprise

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuario
  participant SPA as IdP SPA
  participant BFF as BFF
  participant IP as Identity Platform Admin SDK
  participant MAIL as Servicio correo ETB
  participant AUD as Firestore audit

  U->>SPA: Solicita recuperar contraseña
  SPA->>BFF: POST /api/auth/password-recovery/start
  BFF->>BFF: reCAPTCHA + rate limit
  BFF->>IP: generatePasswordResetLink(email)
  BFF->>MAIL: envía correo ETB con link
  BFF->>AUD: registra evento sin PII sensible
  BFF-->>SPA: respuesta genérica
```

## Claims Recomendados

Los claims se establecen desde BFF con Admin SDK, nunca desde el navegador:

```json
{
  "customer_type": "Hogares",
  "etb_customer_id": "9774689",
  "doc_type": "CC",
  "doc_number_hash": "sha256:<hash>",
  "registration_eligible": true,
  "registration_source": "mulesoft_otp",
  "auth_level": "otp_verified"
}
```

No incluir dirección, fecha de nacimiento, teléfono completo, correo completo ni datos de servicio detallados dentro del ID token.

## Controles De Seguridad

- BFF obligatorio para MuleSoft y Admin SDK.
- Secret Manager para credenciales MuleSoft y JWT internos.
- Rate limit por IP, documento, correo y sesión.
- Firestore para `otp_sessions` con TTL lógico.
- `verificationToken` de BFF de un solo uso, TTL máximo 10 minutos.
- reCAPTCHA Enterprise antes de `lookup`, `otp/send` y recuperación.
- Blocking Function `beforeCreate`/`beforeSignIn` para impedir altas sociales sin validación ETB.
- Logs sin OTP, contraseñas, tokens, correo completo, dirección ni documento completo.

## Matriz Visual De Responsabilidades

```mermaid
flowchart LR
  subgraph SPA["IdP SPA"]
    S1[Captura datos]
    S2[Muestra OTP]
    S3[signInWithCustomToken]
    S4[OIDC redirect]
  end

  subgraph BFF["BFF"]
    B1[Valida reCAPTCHA]
    B2[Rate limit]
    B3[Orquesta MuleSoft]
    B4[Admin SDK]
    B5[Auditoría]
  end

  subgraph MS["MuleSoft"]
    M1[Consulta cliente]
    M2[Envía OTP]
    M3[Valida OTP]
    M4[Registra alta]
  end

  subgraph GCP["Identity Platform"]
    G1[Usuarios]
    G2[Proveedores sociales]
    G3[Password reset]
    G4[ID token]
  end

  S1 --> B1
  B3 --> M1
  B3 --> M2
  B3 --> M3
  B3 --> M4
  B4 --> G1
  S3 --> G4
  S4 --> G4
  G3 --> S1
```

## Fuentes Oficiales

- Identity Platform custom tokens: https://cloud.google.com/identity-platform/docs/admin/create-custom-tokens
- Identity Platform blocking functions: https://cloud.google.com/identity-platform/docs/blocking-functions
- Google provider: https://cloud.google.com/identity-platform/docs/web/google
- Facebook provider: https://cloud.google.com/identity-platform/docs/web/facebook
- Apple provider: https://cloud.google.com/identity-platform/docs/web/apple
- Cloud Run VPC connectors: https://cloud.google.com/run/docs/configuring/vpc-connectors
- Cloud Run secrets: https://cloud.google.com/run/docs/configuring/services/secrets
