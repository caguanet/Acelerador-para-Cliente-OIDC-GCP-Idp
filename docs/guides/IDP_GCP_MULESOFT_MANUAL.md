# Manual Paso A Paso - IdP GCP + MuleSoft + OTP ETB

Fecha de corte: 2026-05-07.

Este manual describe las configuraciones manuales requeridas en GCP, Identity Platform, Google Auth Platform, Apple Developer, Meta Developers, MuleSoft Anypoint y Cloud Run. No contiene secretos reales.

Antes de ejecutar este manual, confirmar la decision arquitectonica en [ADR 0001 - IdP SPA Stateless + BFF Stateful Acotado](../architecture/decisions/0001-idp-spa-stateless-bff-stateful.md). El BFF se configura como componente stateful acotado para MuleSoft, OTP, MS-4, auditoria y Admin SDK; el contrato OIDC hacia clientes sigue siendo el IdP SPA stateless.

## 0. Datos Base A Confirmar

| Campo | Valor esperado |
| --- | --- |
| GCP project ID | `etb-identity-omnicanal` o el proyecto real del ambiente |
| Dominio IdP QA | Pendiente. Usar URL temporal de Cloud Run del IdP solo para QA hasta asignar DNS corporativo. |
| Dominio IdP PROD | Pendiente. Debe definirse antes de publicar providers sociales y pruebas E2E productivas. |
| URL BFF QA | Pendiente. Usar URL temporal de Cloud Run del BFF solo para QA hasta asignar DNS corporativo. |
| URL BFF PROD | Pendiente. Debe definirse antes de CORS final, reCAPTCHA y salida a producción. |
| Regla de negocio | Pendiente de indicador fidedigno MuleSoft; no usar `services[].state.state`. |
| Validación MiPymes | Por documento del representante legal usando MS-1 |

## 1. GCP - APIs

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/apis/library?project=<PROJECT_ID>`

Pasos:

1. Abrir la URL anterior.
2. Buscar y habilitar una por una:
   - Identity Toolkit API
   - Token Service API
   - Secret Manager API
   - Cloud Run Admin API
   - Artifact Registry API
   - Cloud Build API
   - Firestore API
   - reCAPTCHA Enterprise API
   - IAM Service Account Credentials API
   - Serverless VPC Access API, solo si MuleSoft requiere red privada.
3. Validar en `APIs & Services > Enabled APIs & services` que todas queden habilitadas.

## 2. GCP - Secret Manager

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/security/secret-manager?project=<PROJECT_ID>`

Crear estos secretos:

| Secret ID | Valor | Observación |
| --- | --- | --- |
| `mulesoft-client-id` | Client ID vigente | Rotar el expuesto en cURL antes de usar. |
| `mulesoft-client-secret` | Client secret vigente | Nunca copiar a repo ni navegador. |
| `mulesoft-bearer-jwt` | Bearer vigente o token técnico | Confirmar proceso de rotación. |
| `mulesoft-base-url-ms1` | `https://customer-xapi-services-QA.us-e2.cloudhub.io:443` | Cambiar por PROD en ambiente PROD. |
| `mulesoft-base-url-ms2` | `https://mule-worker-internal-experience-xapi-services-QA.us-e2.cloudhub.io:8082` | Validar conectividad privada. |
| `mulesoft-base-url-ms3` | `https://experience-xapi-services-QA.us-e2.cloudhub.io:443` | El path contiene `v1customer`; confirmar si no falta `/`. |
| `mulesoft-base-url-ms4` | Pendiente | Registrar cliente/alta digital ETB antes de crear usuario GCP. |
| `mulesoft-system-id` | `MIGRACION` | Header MS-1. |
| `mulesoft-name` | `silice` | Header común. |
| `mulesoft-source` | `silice` | Header común. |
| `mulesoft-origin` | `SILICE` | Query MS-1. |
| `mulesoft-aplicacion` | `silice` | Body MS-2/MS-3. |
| `bff-verification-jwt-secret` | secreto aleatorio 32+ bytes | Firmar `verificationToken`, no custom token de GCP. |
| `recaptcha-site-key` | site key | Público; puede estar también en runtime config. |

Pasos UI:

1. Click `Create secret`.
2. `Name`: usar el `Secret ID`.
3. `Secret value`: pegar valor.
4. `Replication policy`: Automatic, salvo política interna distinta.
5. Click `Create secret`.
6. Repetir por cada secreto.

## 3. GCP - Service Account BFF

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/iam-admin/serviceaccounts?project=<PROJECT_ID>`

Crear cuenta:

| Campo | Valor |
| --- | --- |
| Service account name | `idp-bff-sa` |
| Service account ID | `idp-bff-sa` |
| Description | `BFF IdP ETB: MuleSoft + Identity Platform Admin SDK` |

Roles mínimos:

- Firebase Authentication Admin
- Service Account Token Creator
- Secret Manager Secret Accessor
- Cloud Datastore User
- Logs Writer
- Monitoring Metric Writer

No descargar JSON de service account para producción. En Cloud Run usar la service account adjunta.

## 4. Identity Platform - Configuración Base

Plataforma: Google Cloud Console  
URL proveedores: `https://console.cloud.google.com/customer-identity/providers?project=<PROJECT_ID>`  
URL configuración: `https://console.cloud.google.com/customer-identity/settings?project=<PROJECT_ID>`

Pasos:

1. Entrar a `Identity Platform`.
2. Si aparece `Enable Identity Platform`, hacer click y esperar aprovisionamiento.
3. Ir a `Settings / Configuración`.
4. Pestaña `Security / Seguridad` > `Authorized domains`:
   - Agregar `localhost` solo para dev/QA.
   - Agregar dominio temporal Cloud Run del IdP QA si se usará para pruebas.
   - Agregar `<IDP_QA_DOMAIN>` cuando Infra/GCP lo confirme.
   - Agregar `<IDP_PROD_DOMAIN>` cuando Infra/GCP lo confirme.
5. Pestaña `Password policy / Política de contraseña`:
   - Minimum length: `8`.
   - Require uppercase: habilitado.
   - Require number: habilitado.
   - Require special character: habilitado.
   - Enforcement: iniciar en modo gradual si hay usuarios legacy; luego `Enforce`.
6. Pestaña `Templates / Plantillas`:
   - Language: Spanish / Spanish Latin America si está disponible.
   - Password reset subject: `Restablece tu contraseña en Mi ETB`.
   - Sender name: `ETB - Mi ETB`.
   - Reply-to: correo operativo ETB.
   - Action URL: `https://<IDP_DOMAIN>/__/auth/action`, usando el dominio confirmado del ambiente. En QA puede ser la URL temporal de Cloud Run si aún no hay DNS corporativo.

## 5. Identity Platform - Email/Password

URL: `https://console.cloud.google.com/customer-identity/providers?project=<PROJECT_ID>`

Pasos:

1. Click `Add A Provider`.
2. Seleccionar `Email / Password`.
3. Campos:
   - Enabled: ON.
   - Email link passwordless: ON para el login principal del IdP por correo.
4. Click `Save`.

Observación: la recuperación de contraseña usa la plantilla de Identity Platform y el SDK actual `sendPasswordResetEmail`.
El OTP MuleSoft se mantiene para registro/alta digital ETB, no para el login principal por correo.

## 6. Google Auth Platform - OAuth Web Client

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/apis/credentials?project=<PROJECT_ID>`

Pasos:

1. Ir a `APIs & Services > Credentials` o `Google Auth Platform > Clients`.
2. Click `Create credentials > OAuth client ID`.
3. Si pide consentimiento:
   - User type: External, salvo que ETB use solo Workspace interno.
   - App name: `ETB - Mi ETB`.
   - User support email: correo de soporte.
   - Authorized domains: `etb.com.co`.
   - Developer contact: correo técnico.
   - Scopes: `openid`, `email`, `profile`.
4. OAuth client:
   - Application type: `Web application`.
   - Name: `ETB IdP Web Client QA` o `ETB IdP Web Client PROD`.
   - Authorized JavaScript origins:
     - `http://localhost:5173`
     - `http://localhost:3000`
     - URL temporal Cloud Run IdP QA si aplica
     - `https://<IDP_QA_DOMAIN>` cuando se confirme
     - `https://<IDP_PROD_DOMAIN>` cuando se confirme
   - Authorized redirect URIs:
     - `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`
     - `https://<IDP_QA_DOMAIN>/__/auth/handler`
     - `https://<IDP_PROD_DOMAIN>/__/auth/handler`
5. Guardar `Client ID` y `Client Secret` en el vault aprobado. No ponerlos en React.

Luego en Identity Platform:

1. `Identity Platform > Providers > Add A Provider > Google`.
2. Enabled: ON.
3. Web Client ID: pegar el Client ID.
4. Web Client secret: pegar el secret.
5. Save.

## 7. Apple Developer + Identity Platform

Plataforma Apple: `https://developer.apple.com/account`  
Requisito: Apple Developer Program activo.

Pasos Apple:

1. Ir a `Certificates, Identifiers & Profiles > Identifiers`.
2. Click `+`.
3. Seleccionar `App IDs > App`.
4. Campos:
   - Description: `ETB IdP`.
   - Bundle ID: `co.com.etb.idp`.
   - Capabilities: marcar `Sign in with Apple`.
5. Guardar.
6. Volver a `Identifiers`, click `+`.
7. Seleccionar `Services IDs`.
8. Campos:
   - Description: `ETB IdP Web`.
   - Identifier: `co.com.etb.idp.web`.
9. Editar el Services ID, marcar `Sign in with Apple`, click `Configure`.
10. Campos:
    - Primary App ID: `co.com.etb.idp`.
    - Domains and Subdomains: `<PROJECT_ID>.firebaseapp.com`, `<IDP_QA_DOMAIN>`, `<IDP_PROD_DOMAIN>`.
    - Return URLs:
      - `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`
      - `https://<IDP_QA_DOMAIN>/__/auth/handler`
      - `https://<IDP_PROD_DOMAIN>/__/auth/handler`
11. Ir a `Keys > +`.
12. Campos:
    - Key Name: `ETB IdP Sign in with Apple`.
    - Capability: `Sign in with Apple`.
    - Configure: seleccionar App ID `co.com.etb.idp`.
13. Descargar `.p8` una sola vez.
14. Anotar `Team ID` y `Key ID`.

Pasos GCP:

1. `Identity Platform > Providers > Add A Provider > Apple`.
2. Campos:
   - Enabled: ON.
   - Platform: Web.
   - Service ID: `co.com.etb.idp.web`.
   - Apple Team ID: valor de Apple.
   - Key ID: valor de Apple.
   - Private key: contenido completo del `.p8`.
3. Save.

Observación: si el usuario usa Hide My Email, Apple puede retornar `privaterelay.appleid.com`. No se debe vincular ese alias con PII ETB sin consentimiento explícito.

## 8. Meta Developers + Identity Platform Facebook

Plataforma Meta: `https://developers.facebook.com/apps/`

Pasos Meta:

1. Click `Create App`.
2. Use case: `Authenticate and request data from users with Facebook Login`.
3. App type: `Consumer`.
4. App name: `ETB IdP QA` o `ETB IdP Prod`.
5. En `App settings > Basic`:
   - App Domains: `<IDP_QA_DOMAIN>`, `<IDP_PROD_DOMAIN>`, `<PROJECT_ID>.firebaseapp.com`.
   - Privacy Policy URL: URL legal ETB.
   - Terms of Service URL: URL legal ETB.
   - User Data Deletion URL: URL/proceso ETB requerido por Meta.
   - Category: Business.
6. `Add product > Facebook Login > Set up`.
7. `Facebook Login > Settings`:
   - Client OAuth Login: Yes.
   - Web OAuth Login: Yes.
   - Valid OAuth Redirect URIs:
     - `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`
     - `https://<IDP_QA_DOMAIN>/__/auth/handler`
     - `https://<IDP_PROD_DOMAIN>/__/auth/handler`
8. En producción, completar App Review si Meta lo exige para usuarios reales.

Pasos GCP:

1. `Identity Platform > Providers > Add A Provider > Facebook`.
2. Campos:
   - Enabled: ON.
   - App ID: valor Meta.
   - App secret: valor Meta.
3. Save.

## 9. reCAPTCHA Enterprise

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/security/recaptcha?project=<PROJECT_ID>`

Pasos:

1. Click `Create key`.
2. Campos:
   - Display name: `ETB IdP Web QA` o `ETB IdP Web PROD`.
   - Platform type: Website.
   - Domains:
     - `localhost`
     - dominio temporal Cloud Run IdP QA si aplica
     - `<IDP_QA_DOMAIN>` cuando se confirme
     - `<IDP_PROD_DOMAIN>` cuando se confirme
   - Challenge type: score-based/invisible para BFF.
3. Click `Create key`.
4. Guardar Site Key en runtime config del IdP y Secret Manager.

## 10. Firestore

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/firestore/databases?project=<PROJECT_ID>`

Pasos:

1. Click `Create database`.
2. Mode: Native mode.
3. Location: misma región lógica del proyecto o región aprobada por ETB.
4. Crear colecciones por uso:
   - `otp_sessions`
   - `accept_logs`
   - `auth_audit_events`
   - `registration_events`

Campos mínimos `otp_sessions`:

```json
{
  "bffSessionId": "...",
  "mode": "REGISTER|LOGIN",
  "docType": "CC",
  "customerId": "9774689",
  "segment": "Hogares",
  "flow": "HOGARES|MIPYMES",
  "legalRepDocType": "CC",
  "legalRepDocNumberHash": "sha256:<hash>",
  "companyDocType": "NIT",
  "companyDocNumberHash": "sha256:<hash opcional>",
  "email": "correo original",
  "maskedEmail": "no****@gmail.com",
  "idTransaccion": "...",
  "attempts": 0,
  "status": "INITIATED|OTP_SENT|OTP_VERIFIED|REGISTERED|BLOCKED|EXPIRED",
  "createdAt": "timestamp",
  "expiresAt": "timestamp"
}
```

Para MiPymes, el BFF debe crear la sesión con los datos del representante legal. Si se captura NIT de empresa en la UI, se guarda como dato auxiliar/auditoría. La elegibilidad debe venir de un indicador confiable de MuleSoft, no de `services[].state.state`.

## 11. Cloud Run BFF

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/run?project=<PROJECT_ID>`

Pasos UI al desplegar:

1. Click `Deploy container`.
2. Service name: `idp-bff-service`.
3. Region: la definida por ETB.
4. Authentication:
   - Si solo lo invoca el IdP público desde navegador, permitir unauthenticated pero con CORS estricto + reCAPTCHA + rate limit.
   - Si se pone detrás de Load Balancer/API Gateway, restringir según diseño.
5. Container:
   - Port: `8080`.
   - CPU: `1`.
   - Memory: `512Mi` inicial.
   - Min instances: `1` para reducir latencia OTP.
   - Max instances: definir según capacidad MuleSoft.
   - Concurrency: iniciar con `20` y ajustar.
6. Security:
   - Service account: `idp-bff-sa`.
7. Variables no secretas:
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://<IDP_PROD_DOMAIN>,https://<IDP_QA_DOMAIN>`
   - `PROJECT_ID=<PROJECT_ID>`
8. Secrets:
   - Montar o exponer como env cada secreto de la sección 2.
9. Networking:
   - Si MS-2 es privado, seleccionar `Serverless VPC Access connector`.
   - Egress: `private-ranges-only` si MuleSoft privado usa rangos privados; `all-traffic` solo si se configura Cloud NAT.

## 12. MuleSoft Anypoint

Plataforma: `https://anypoint.mulesoft.com/`

Tareas para equipo MuleSoft/API:

1. Rotar credenciales expuestas en QA.
2. Confirmar si el bearer se obtiene por Connected App OAuth client credentials.
3. En `API Manager`, validar políticas:
   - Client ID Enforcement espera `client_id` y `client_secret` en headers.
   - Rate limiting/SLA acordado con IdP.
4. En `Runtime Manager / CloudHub`, confirmar conectividad de:
   - MS-1 público 443.
   - MS-2 `internal` puerto 8082.
   - MS-3 público 443.
5. Si hay allowlist:
   - Registrar IP egress del Cloud NAT o rango aprobado.
6. Definir y publicar MS-4 registrar cliente/alta digital.
7. Confirmar códigos de error y SLA.

### 12.1. MS-4 Requerido - Registro De Identidad Digital / Alta Digital

Este servicio falta y es necesario para cerrar el flujo de producción si el alta en ETB debe quedar registrada antes de crear usuario en GCP.

Contrato funcional:

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `aplicacion` | string | Sí | `silice`. |
| `id_transaccion_otp` | string | Sí | `id_transaccion` retornado por MS-2 y validado por MS-3. |
| `tipo_cliente` | string | Sí | `HOGARES` o `MIPYMES`. |
| `tipo_documento` | string | Sí | Tipo documento usado en MS-1. |
| `numero_documento` | string | Sí | Documento usado en MS-1. Para MiPymes, representante legal. |
| `nit_empresa` | string | No | Solo si la UI lo captura para MiPymes. |
| `correo_registrado` | string | Sí | `contactData.email` de MS-1. |
| `acepta_terminos` | boolean | Sí | Debe ser `true`. |
| `version_terminos` | string | Sí | Versión legal vigente. |
| `acepta_tratamiento_datos` | boolean | Sí | Debe ser `true`. |
| `version_tratamiento_datos` | string | Sí | Versión legal vigente. |
| `proveedor_identidad` | string | Sí | `GCP_IDENTITY_PLATFORM`. |
| `correlation_id` | string | Sí | Mismo `X-CORRELATION-ID` o correlador BFF. |

Respuesta esperada:

```json
{
  "codigo": "200",
  "id_registro": "REG-...",
  "estado": "REGISTRADO"
}
```

Regla de implementación:

- BFF llama MS-4 después de MS-3 exitoso y antes de `admin.auth().createUser`.
- Si MS-4 responde distinto de éxito, BFF devuelve error funcional al IdP y no crea usuario GCP.
- Si MS-4 es idempotente, debe aceptar reintentos con el mismo `id_transaccion_otp`/`correlation_id`.
- Si el usuario ya existe en GCP pero no hay registro MS-4 exitoso, el BFF no emite custom token.

## 13. Recuperación De Contraseña

Se mantiene con Identity Platform para cuentas con Email/Password. Hay dos alternativas.

### 13.1. Configuración Manual En GCP

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/customer-identity/settings?project=<PROJECT_ID>`

Pasos:

1. Entrar a `Identity Platform`.
2. Ir a `Settings / Configuración`.
3. Abrir `Templates / Plantillas`.
4. Seleccionar `Password reset / Restablecimiento de contraseña`.
5. Diligenciar:
   - Language: `Spanish` o `Spanish (Latin America)` si aparece.
   - Sender name: `ETB - Mi ETB`.
   - Reply-to: correo operativo ETB.
   - Subject: `Restablece tu contraseña en Mi ETB`.
   - Message: texto ETB con el placeholder del enlace que provee GCP.
   - Action URL QA: `https://<IDP_QA_DOMAIN>/__/auth/action`. Si aún no hay DNS corporativo, usar la URL temporal de Cloud Run del IdP QA.
   - Action URL PROD: `https://<IDP_PROD_DOMAIN>/__/auth/action`. No diligenciar con un dominio tentativo hasta que Infra/GCP confirme el dominio definitivo.
6. Guardar cambios.
7. Ir a `Security / Seguridad > Authorized domains`.
8. Confirmar que están:
   - `localhost` para dev.
   - dominio temporal Cloud Run IdP QA, mientras no exista DNS corporativo.
   - dominio corporativo QA definitivo cuando Infra/GCP lo confirme.
   - dominio corporativo PROD definitivo cuando Infra/GCP lo confirme.

SMTP custom opcional:

1. En la misma plantilla, abrir `Customize SMTP settings`, si está disponible en el proyecto.
2. Campos:
   - SMTP server: servidor ETB/SendGrid aprobado.
   - Port: `587`.
   - Username: usuario SMTP.
   - Password: secreto SMTP.
   - From: `auth@etb.com.co`.
3. Validar SPF/DKIM/DMARC del dominio para evitar spam.

### 13.2. Implementación Aprobada - SDK En IdP (MVP)

Decisión del alcance actual: recuperación de contraseña por MVP con Firebase JS SDK `sendPasswordResetEmail`. El código actual usa `sendPasswordResetEmail` en `PasswordlessLoginForm`.

Implementación requerida:

1. Mantener `sendPasswordResetEmail(auth, email)`.
2. Configurar idioma:

```ts
auth.languageCode = "es";
```

3. Mostrar siempre mensaje genérico:
   - `Si el correo está registrado, enviaremos instrucciones para restablecer tu contraseña.`
4. No revelar si existe o no el usuario.
5. Aplicar rate limit visual y, si se mueve a BFF, rate limit real.

Ventajas: menor desarrollo, GCP administra action code y formulario de cambio.  
Limitación aceptada para MVP: menor control de auditoría desde ETB.

### 13.3. Alternativa Futura - BFF/Admin SDK (Enterprise)

Fuera del alcance inicial. Usar solo si ETB requiere auditoría central, rate limit server-side o envío por correo ETB propio.

Endpoint recomendado:

`POST /api/auth/password-recovery/start`

Request:

```json
{
  "email": "cliente@dominio.com",
  "recaptchaToken": "..."
}
```

Flujo:

1. BFF valida reCAPTCHA.
2. BFF aplica rate limit por IP/email.
3. BFF responde siempre genérico, exista o no el usuario.
4. Si el usuario existe, BFF usa Admin SDK:

```ts
const link = await getAuth().generatePasswordResetLink(email, {
  url: "https://<IDP_DOMAIN>",
  handleCodeInApp: false,
});
```

5. BFF envía el correo con proveedor ETB o delega al mecanismo aprobado.
6. BFF registra `auth_audit_events` sin guardar el link completo ni PII innecesaria.

Ventajas: auditoría y control ETB.  
Limitación: requiere servicio de correo propio y más desarrollo.

### 13.4. Qué Pasa Con OTP Y Redes Sociales

- Recuperación de contraseña aplica solo a cuentas que tienen contraseña.
- Cuentas que solo usan Google/Apple/Facebook deben iniciar por su proveedor, siempre que estén validadas/habilitadas como usuario ETB.
- El OTP corto de MuleSoft se mantiene para registro/alta digital ETB, no como login principal del IdP.
- Si el usuario existe con password y también con social vinculado, puede usar email link/passwordless o el proveedor social habilitado.

## 14. Fuentes Oficiales

- Identity Platform custom tokens: https://cloud.google.com/identity-platform/docs/admin/create-custom-tokens
- Identity Platform Google: https://cloud.google.com/identity-platform/docs/web/google
- Identity Platform Facebook: https://cloud.google.com/identity-platform/docs/web/facebook
- Identity Platform Apple: https://cloud.google.com/identity-platform/docs/web/apple
- Identity Platform blocking functions: https://cloud.google.com/identity-platform/docs/blocking-functions
- Cloud Run secrets: https://cloud.google.com/run/docs/configuring/services/secrets
- Cloud Run VPC connectors: https://cloud.google.com/run/docs/configuring/vpc-connectors
- reCAPTCHA Enterprise keys: https://cloud.google.com/recaptcha/docs/create-key-website
- Secret Manager: https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets
