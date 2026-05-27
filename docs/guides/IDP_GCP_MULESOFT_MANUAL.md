# Manual operativo - IdP GCP + MuleSoft + OTP ETB

Fecha de corte: 2026-05-25.

Este manual conserva las configuraciones operativas que no pertenecen al pipeline ni al setup local: proveedores sociales externos, Firestore/auditoria, MuleSoft Anypoint, MS-4 y recuperacion de contrasena.

La configuracion productiva viva de Cloud Run `idp-service`, Secret Manager, IAM, Firebase/Auth, reCAPTCHA y variables de entorno esta centralizada en [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md). El despliegue de imagenes esta en [DEPLOY.md](DEPLOY.md). El setup local esta en [CONFIGURACION-PASO-A-PASO.md](CONFIGURACION-PASO-A-PASO.md).

Antes de ejecutar este manual, confirmar la decision arquitectonica en [ADR 0001 - IdP SPA Stateless + BFF Stateful Acotado](../architecture/decisions/0001-idp-spa-stateless-bff-stateful.md). El contrato OIDC hacia clientes sigue siendo SPA stateless; el componente stateful queda acotado a MuleSoft, OTP, MS-4, auditoria y Admin SDK.

## 1. Datos base a confirmar

| Campo | Estado |
| --- | --- |
| GCP project ID | `etb-identity-omnicanal` o proyecto real del ambiente. |
| Dominio IdP QA | Pendiente. Puede usarse URL temporal de Cloud Run solo para QA. |
| Dominio IdP PROD | Pendiente. Debe definirse antes de publicar providers sociales y pruebas productivas. |
| Regla de negocio | Pendiente de indicador fidedigno MuleSoft; no usar `services[].state.state`. |
| Validacion MiPymes | Por documento del representante legal usando MS-1. |
| MS-4 | Pendiente de contrato definitivo si alta digital debe registrarse antes de crear usuario GCP. |

## 2. Donde se configura cada bloque

| Bloque | Documento canonico |
| --- | --- |
| APIs GCP, Secret Manager, IAM, Cloud Run, Firebase/Auth, reCAPTCHA | [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md) |
| Build/deploy/rollback de Cloud Run | [DEPLOY.md](DEPLOY.md) |
| Desarrollo local, `.env.local`, mock client y pruebas locales | [CONFIGURACION-PASO-A-PASO.md](CONFIGURACION-PASO-A-PASO.md) |
| Arquitectura implementada vs objetivo | [IDP_MULESOFT_GCP_ARCHITECTURE.md](../architecture/IDP_MULESOFT_GCP_ARCHITECTURE.md) |
| Historia y contrato propuesto MS-4 | [HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md](../planning/HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md) |

## 3. Google Auth Platform - OAuth Web Client

La configuracion minima productiva de OAuth Web Client esta en [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md#73-oauth-client-para-google-social-login). Esta seccion conserva criterios operativos para el proveedor Google.

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/apis/credentials?project=<PROJECT_ID>`

Pasos:

1. Ir a `Google Auth Platform > Clients` o `APIs & Services > Credentials`.
2. Crear o abrir el OAuth client de tipo `Web application`.
3. Si pide pantalla de consentimiento:
   - User type: External, salvo que ETB use solo Workspace interno.
   - App name: `ETB - Mi ETB`.
   - User support email: correo de soporte.
   - Authorized domains: `etb.com.co` y dominios corporativos aprobados.
   - Developer contact: correo tecnico.
   - Scopes: `openid`, `email`, `profile`.
4. En el OAuth client:
   - Name: `ETB IdP Web Client QA` o `ETB IdP Web Client PROD`.
   - Authorized JavaScript origins: dominio IdP del ambiente.
   - Authorized redirect URIs: handler Firebase/Auth del ambiente.
5. Guardar `Client ID` y `Client Secret` en el vault aprobado.
6. Configurar `Identity Platform > Providers > Google` con ese client.

No poner client secrets en React, `public/config.js`, `.env.local` commiteado ni documentacion.

## 4. Apple Developer + Identity Platform

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

Si el usuario usa Hide My Email, Apple puede retornar `privaterelay.appleid.com`. No se debe vincular ese alias con PII ETB sin consentimiento explicito.

## 5. Meta Developers + Identity Platform Facebook

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
8. En produccion, completar App Review si Meta lo exige para usuarios reales.

Pasos GCP:

1. `Identity Platform > Providers > Add A Provider > Facebook`.
2. Campos:
   - Enabled: ON.
   - App ID: valor Meta.
   - App secret: valor Meta.
3. Save.

## 6. Firestore y auditoria

Plataforma: Google Cloud Console  
URL: `https://console.cloud.google.com/firestore/databases?project=<PROJECT_ID>`

Firestore aplica cuando se materialice el BFF stateful objetivo o cuando se migre el almacenamiento en memoria actual a persistencia auditada.

Pasos:

1. Click `Create database`.
2. Mode: Native mode.
3. Location: region aprobada por ETB.
4. Crear colecciones por uso:
   - `otp_sessions`
   - `accept_logs`
   - `auth_audit_events`
   - `registration_events`

Campos minimos `otp_sessions`:

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

Para MiPymes, el BFF debe crear la sesion con los datos del representante legal. Si se captura NIT de empresa en UI, guardarlo como dato auxiliar/auditoria. La elegibilidad debe venir de un indicador confiable de MuleSoft.

## 7. MuleSoft Anypoint

Plataforma: `https://anypoint.mulesoft.com/`

Tareas para equipo MuleSoft/API:

1. Rotar credenciales expuestas en QA antes de uso productivo.
2. Confirmar si el bearer se obtiene por Connected App OAuth client credentials o por token tecnico.
3. En `API Manager`, validar politicas:
   - Client ID Enforcement espera `client_id` y `client_secret` en headers.
   - Rate limiting/SLA acordado con IdP.
4. En `Runtime Manager / CloudHub`, confirmar conectividad:
   - MS-1 publico 443.
   - MS-2 `internal` puerto 8082.
   - MS-3 publico 443.
   - MS-4 segun contrato definitivo.
5. Si hay allowlist, registrar IP egress del Cloud NAT o rango aprobado.
6. Definir y publicar MS-4 registrar cliente/alta digital.
7. Confirmar codigos de error, payloads y SLA.

Variables y secretos Cloud Run para MuleSoft se configuran en [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md#9-mulesoft).

## 8. MS-4 requerido - registro de identidad digital / alta digital

MS-4 es necesario para cerrar el flujo de produccion si el alta en ETB debe quedar registrada antes de crear usuario en GCP.

Contrato funcional propuesto:

| Campo | Tipo | Requerido | Descripcion |
| --- | --- | --- | --- |
| `aplicacion` | string | Si | `silice`. |
| `id_transaccion_otp` | string | Si | `id_transaccion` retornado por MS-2 y validado por MS-3. |
| `tipo_cliente` | string | Si | `HOGARES` o `MIPYMES`. |
| `tipo_documento` | string | Si | Tipo documento usado en MS-1. |
| `numero_documento` | string | Si | Documento usado en MS-1. Para MiPymes, representante legal. |
| `nit_empresa` | string | No | Solo si la UI lo captura para MiPymes. |
| `correo_registrado` | string | Si | `contactData.email` de MS-1. |
| `acepta_terminos` | boolean | Si | Debe ser `true`. |
| `version_terminos` | string | Si | Version legal vigente. |
| `acepta_tratamiento_datos` | boolean | Si | Debe ser `true`. |
| `version_tratamiento_datos` | string | Si | Version legal vigente. |
| `proveedor_identidad` | string | Si | `GCP_IDENTITY_PLATFORM`. |
| `correlation_id` | string | Si | Mismo `X-CORRELATION-ID` o correlador BFF. |

Respuesta esperada:

```json
{
  "codigo": "200",
  "id_registro": "REG-...",
  "estado": "REGISTRADO"
}
```

Reglas:

- BFF llama MS-4 despues de MS-3 exitoso y antes de `admin.auth().createUser`.
- Si MS-4 responde distinto de exito, BFF devuelve error funcional al IdP y no crea usuario GCP.
- Si MS-4 es idempotente, debe aceptar reintentos con el mismo `id_transaccion_otp`/`correlation_id`.
- Si el usuario ya existe en GCP pero no hay registro MS-4 exitoso, el BFF no emite custom token.

La historia funcional detallada vive en [HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md](../planning/HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md).

## 9. Recuperacion de contrasena

Decision vigente para MVP: usar Firebase JS SDK `sendPasswordResetEmail`. La configuracion de plantillas en Identity Platform esta consolidada en [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md#70-providers-password-policy-y-plantillas).

Implementacion requerida en el IdP:

1. Mantener `sendPasswordResetEmail(auth, email, actionCodeSettings)` desde la SPA.
2. Configurar idioma:

```ts
auth.languageCode = "es";
```

3. Mostrar siempre mensaje generico:
   - `Si el correo esta registrado, enviaremos instrucciones para restablecer tu contrasena.`
4. No revelar si existe o no el usuario.
5. Aplicar rate limit visual y, si se mueve a BFF, rate limit real.
6. Configurar en Identity Platform / Firebase Templates la URL de accion personalizada hacia:

```text
https://<IDP_DOMAIN>/auth/action
```

La SPA implementa `mode=resetPassword` en esa ruta con branding ETB. Evitar el handler reservado `__/auth/action` para este flujo cuando se quiera experiencia white-label.

### Alternativa futura BFF/Admin SDK

Fuera del alcance inicial. Usar solo si ETB requiere auditoria central, rate limit server-side o envio por correo ETB propio.

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
3. BFF responde siempre generico, exista o no el usuario.
4. Si el usuario existe, BFF usa Admin SDK:

```ts
const link = await getAuth().generatePasswordResetLink(email, {
  url: "https://<IDP_DOMAIN>",
  handleCodeInApp: false,
});
```

5. BFF envia el correo con proveedor ETB o delega al mecanismo aprobado.
6. BFF registra `auth_audit_events` sin guardar el link completo ni PII innecesaria.

### OTP y redes sociales

- Recuperacion de contrasena aplica solo a cuentas que tienen contrasena.
- Cuentas que solo usan Google/Apple/Facebook deben iniciar por su proveedor, siempre que esten validadas/habilitadas como usuario ETB.
- El OTP corto de MuleSoft se mantiene para registro/alta digital ETB, no como login principal del IdP.
- Si el usuario existe con password y tambien con social vinculado, puede usar email link/passwordless o el proveedor social habilitado.

## 10. Fuentes oficiales

- Identity Platform custom tokens: https://cloud.google.com/identity-platform/docs/admin/create-custom-tokens
- Identity Platform Google: https://cloud.google.com/identity-platform/docs/web/google
- Identity Platform Facebook: https://cloud.google.com/identity-platform/docs/web/facebook
- Identity Platform Apple: https://cloud.google.com/identity-platform/docs/web/apple
- Identity Platform blocking functions: https://cloud.google.com/identity-platform/docs/blocking-functions
- Cloud Run VPC connectors: https://cloud.google.com/run/docs/configuring/vpc-connectors
