# Plan De Trabajo - IdP GCP + MuleSoft + OTP ETB

Fecha de corte: 2026-05-07.

Este plan está diseñado para que cualquier IA, LLM o integrante humano pueda retomar el trabajo aunque se corte el contexto. Antes de implementar, leer:

1. `AGENTS.md`
2. `docs/architecture/TECH_README.md`
3. `docs/architecture/IDP_MULESOFT_GCP_ARCHITECTURE.md`
4. `docs/architecture/decisions/0001-idp-spa-stateless-bff-stateful.md`
5. `docs/guides/IDP_GCP_MULESOFT_MANUAL.md`

## Regla De Elegibilidad

No usar esta inferencia para producción:

```ts
customer.services.some((service) => service.state?.state === "Activo")
```

Ese dato no es fidedigno. El registro debe depender de un indicador explícito de MuleSoft, por ejemplo `eligibleForDigitalRegistration`, `hasActiveServices` confiable, `registrationEligibility.status`, o un servicio MS dedicado.

Hasta que MuleSoft entregue ese indicador, el BFF no debe crear usuarios en Identity Platform en producción.

## Estado De Avance Para Retomar

Actualizar esta tabla al terminar cada sesión de trabajo.

| Fase | Estado | Responsable | Fecha | Evidencia |
| --- | --- | --- | --- | --- |
| 0. Rotación secretos y preguntas MuleSoft | Pendiente |  |  |  |
| 1. Configuración GCP base | Pendiente |  |  |  |
| 2. Identity Platform providers | Pendiente |  |  |  |
| 3. BFF scaffold | Pendiente |  |  |  |
| 4. Cliente MuleSoft BFF | Pendiente |  |  |  |
| 5. MS-4 registro identidad digital ETB | Pendiente |  |  |  |
| 6. Custom tokens + claims | Pendiente |  |  |  |
| 7. Integración React | Pendiente |  |  |  |
| 8. Recuperación contraseña GCP | Pendiente |  |  |  |
| 9. Blocking functions / control social | Pendiente |  |  |  |
| 10. Pruebas | Pendiente |  |  |  |
| 11. Documentación final y handoff | Pendiente |  |  |  |

## Preguntas Bloqueantes Antes De Codificar

1. ¿MS-2 `mule-worker-internal...:8082` es accesible desde internet, por VPN/peering, o requiere IP allowlist?
2. ¿El bearer JWT MuleSoft se rota manualmente o existe endpoint OAuth client credentials?
3. ¿Se permite que un cliente cambie el correo durante registro? Recomendación: no en producción; OTP al correo registrado.
4. ¿Qué dominios definitivos se usarán para QA y PROD? Estado actual: no definidos; usar URL temporal de Cloud Run solo para QA mientras Infra/GCP asigna DNS corporativo.
6. ¿Cuál será el contrato definitivo de MS-4 registrar cliente/alta digital?
7. ¿Cuál campo/servicio fidedigno de MuleSoft confirma que el cliente puede registrarse?

## Decisiones Confirmadas

- Elegibilidad: pendiente de campo/servicio fidedigno MuleSoft; no inferir desde `services[].state.state`.
- MiPymes: validación por representante legal usando MS-1 con documento del representante.
- OTP: se envía al correo registrado que retorna MS-1.
- MS-4: debe existir antes de producción; el BFF no crea usuario GCP hasta que MS-4 responda OK.
- Autenticación principal: OTP + redes sociales. No se mostrará login por contraseña como método principal.
- Recuperación de contraseña: MVP con Identity Platform/Firebase SDK usando `sendPasswordResetEmail`.
- Dominios IdP/BFF QA y PROD: pendientes de definición; no asumir dominios tentativos hasta confirmación de Infra/GCP.

## Fase 0 - Seguridad Inicial

Objetivo: cerrar riesgos antes de crear código.

Tareas:

- Rotar `client_secret` MuleSoft QA expuesto.
- Revocar/regenerar bearer JWT si aplica.
- Crear secretos en Secret Manager según el manual.
- Confirmar conectividad MS-2.
- Crear ticket/registro de decisión para el indicador fidedigno de elegibilidad MuleSoft.

Criterio de aceptación:

- Ningún secreto MuleSoft queda en `.env.local`, `public/config.js`, documentación o logs.
- Hay respuesta escrita del equipo MuleSoft a las preguntas bloqueantes.

## Fase 1 - GCP Base

Objetivo: preparar servicios GCP.

Tareas:

- Habilitar APIs.
- Crear `idp-bff-sa`.
- Asignar roles mínimos.
- Crear Firestore.
- Crear reCAPTCHA Enterprise key.
- Configurar Secret Manager.

Criterio de aceptación:

- BFF puede acceder a Secret Manager y Firestore desde una prueba mínima.
- reCAPTCHA devuelve assessments válidos en QA.

## Fase 2 - Identity Platform

Objetivo: dejar proveedores listos.

Tareas:

- Habilitar Email/Password.
- Configurar Google.
- Configurar Apple.
- Configurar Facebook.
- Configurar dominios autorizados.
- Configurar plantilla password reset ETB.
- Configurar política de contraseña.

Criterio de aceptación:

- `signInWithPopup` funciona en local/QA para Google, Apple y Facebook con usuarios de prueba.
- Password reset envía correo desde la plantilla configurada.

## Fase 3 - BFF Scaffold

Objetivo: crear servicio Cloud Run independiente.

Estructura recomendada:

```text
bff/
  package.json
  tsconfig.json
  Dockerfile
  src/
    index.ts
    config/
      env.ts
      secrets.ts
    clients/
      mulesoft-base.ts
      ms1-customer.ts
      ms2-otp.ts
      ms3-otp.ts
      ms4-registration.ts
      identity-platform.ts
    routes/
      customers.ts
      otp.ts
      auth-otp.ts
      health.ts
    services/
      eligibility.ts
      otp-session.ts
      registration.ts
      recaptcha.ts
      audit.ts
    middlewares/
      cors.ts
      rate-limit.ts
      error-handler.ts
    types/
      mulesoft.ts
      api.ts
```

Endpoints mínimos:

- `GET /healthz`
- `POST /api/customers/lookup`
- `POST /api/otp/send`
- `POST /api/otp/verify`
- `POST /api/customers/register`

Nota: el login principal del IdP usa Firebase Email Link/passwordless desde la SPA. El OTP corto se conserva para registro/alta digital ETB; un OTP de login por correo requeriría una fase futura con BFF y proveedor de correo/OTP.

Criterio de aceptación:

- `GET /healthz` responde sin tocar MuleSoft.
- CORS solo permite dominios IdP configurados.
- Logs redactan `password`, `code`, `Authorization`, `client_secret`, `email`, `document`.

## Fase 4 - Cliente MuleSoft

Objetivo: reemplazar mocks por servicios reales desde BFF.

MS-1:

- Method: `GET`.
- Path: `/v1/customer`.
- Query:
  - `ORIGIN=SILICE`
  - `CUSTOMER_ID=<docNumber>`
  - `CUSTOMER_ID_TYPE=<docType>`
- Headers:
  - `systemId`
  - `name`
  - `source`
  - `client_id`
  - `client_secret`
  - `Authorization: Bearer <secret>`
  - `X-CORRELATION-ID`

Para MiPymes:

- `CUSTOMER_ID_TYPE=<repDocType>`.
- `CUSTOMER_ID=<repDocNumber>`.
- La UI captura `companyDocType: "NIT"` y `companyDocNumber`; el BFF los conserva congelados en sesión y los envía/adjunta a MuleSoft como dato de validación/auditoría según contrato vigente.
- Después de OTP, la SPA solo muestra el correo enmascarado y los documentos validados como solo lectura; el registro final no acepta documentos reenviados por el navegador.

MS-2:

- Method: `POST`.
- Path: `/operations/v1/customer/otp`.
- Body:
  - `aplicacion`
  - `id_almacenamiento`
  - `nombre_cliente`
  - `identificacion_cliente`
  - `tipo_canal: "EMAIL"`
  - `valor_canal: customer.contactData.email`

MS-3:

- Method: `POST`.
- Path: `/operations/v1customer/otp/validation`.
- Body:
  - `aplicacion`
  - `tipo_canal: "CORREO ELECTRONICO"`
  - `id_transaccion`
  - `codigo`

MS-4:

- Estado: servicio faltante, contrato pendiente con MuleSoft.
- Objetivo: registrar cliente/alta digital ETB después de OTP validado y antes de crear usuario en GCP.
- Request recomendado:
  - `aplicacion`
  - `id_transaccion_otp`
  - `tipo_cliente`
  - `tipo_documento`
  - `numero_documento`
  - `nit_empresa` opcional para MiPymes
  - `correo_registrado`
  - `acepta_terminos`
  - `version_terminos`
  - `acepta_tratamiento_datos`
  - `version_tratamiento_datos`
  - `proveedor_identidad: "GCP_IDENTITY_PLATFORM"`
  - `correlation_id`
- Response esperado:
  - `codigo: "200"`
  - `id_registro`
  - `estado: "REGISTRADO"`

Criterio de aceptación:

- MS-1 fixture real no usa `services[].state.state` como fuente de verdad; la elegibilidad sale de campo/servicio aprobado.
- OTP send guarda `id_transaccion`.
- OTP verify marca sesión como `OTP_VERIFIED`.
- MS-4 mockeado en dev y contrato real aprobado por MuleSoft antes de producción.

## Fase 5 - MS-4 Registro Identidad Digital ETB

Objetivo: incorporar el servicio faltante de registro interno ETB.

Flujo:

1. Recibir `verificationToken` desde el IdP.
2. Validar sesión `OTP_VERIFIED`.
3. Llamar MS-4 con datos mínimos y versiones legales.
4. Persistir respuesta MS-4 en `registration_events`.
5. Solo si MS-4 responde OK, continuar a Identity Platform.

Criterio de aceptación:

- Si MS-4 falla, no se crea usuario GCP.
- Si MS-4 responde OK, queda `id_registro` asociado a la sesión.
- Reintentos con el mismo OTP/correlación son idempotentes o devuelven estado conocido.

## Fase 6 - Registro En Identity Platform

Objetivo: crear usuario en GCP después del OTP.

Flujo:

1. Validar `verificationToken` BFF.
2. Releer sesión Firestore y confirmar estado `OTP_VERIFIED`.
3. Validar que no esté usado.
4. Confirmar registro MS-4 OK.
5. Crear usuario con Admin SDK:
   - `email`
   - `password`
   - `displayName`
   - `emailVerified: true`
   - `disabled: false`
6. Setear custom claims ETB.
7. Guardar `accept_logs`.
8. Crear custom token.
9. Responder `{ customToken }`.

Criterio de aceptación:

- El usuario creado puede hacer `signInWithCustomToken`.
- `getIdToken(true)` incluye claims.
- Reusar el mismo `verificationToken` falla.

## Fase 7 - Integración React

Objetivo: quitar mocks y crear sesión real.

Cambios:

- `src/App.tsx`: usar Firebase Email Link/passwordless como login principal del IdP.
- `src/components/RegisterForm.tsx`: reemplazar `setTimeout` y `createUserWithEmailAndPassword`.
- Crear `src/services/etbAuthApi.ts`.
- Crear `src/services/recaptcha.ts`.
- Agregar runtime config:
  - `BACKEND_URL`
  - `RECAPTCHA_SITE_KEY`

Criterio de aceptación:

- Login por email link redirige al RP con `id_token`.
- Registro Hogares crea usuario en Identity Platform vía BFF.
- Registro bloquea cuando MuleSoft responde no elegible o no entrega indicador fidedigno.

## Fase 8 - Recuperación Contraseña GCP

Objetivo: configurar e implementar recuperación administrada por Identity Platform.

Decisión aprobada: MVP con Firebase JS SDK `sendPasswordResetEmail`. La opción Enterprise por BFF/Admin SDK queda fuera del alcance inicial y solo se retomará si Seguridad/Operación exige auditoría central o envío de correo corporativo.

Tareas MVP:

1. Configurar plantilla `Password reset` en Identity Platform.
2. Mantener `sendPasswordResetEmail(auth, email)` en `PasswordlessLoginForm`.
3. Definir `auth.languageCode = "es"`.
4. Mostrar respuesta genérica para no enumerar usuarios.
5. Configurar el action URL con el dominio IdP definido para cada ambiente. Mientras no exista DNS corporativo en QA, usar la URL pública temporal de Cloud Run del IdP.

Criterio de aceptación:

- Usuario con password recibe link GCP válido.
- Link abre dominio autorizado del IdP.
- Usuario social-only no recibe instrucción confusa; se le orienta a iniciar por proveedor social u OTP.
- La UI no revela si el correo existe.

## Fase 9 - Control De Redes Sociales

Objetivo: impedir alta social sin validación ETB.

Riesgo:

- `signInWithPopup` puede crear un usuario nuevo si el proveedor está habilitado.

Controles:

1. Configurar `beforeCreate` blocking function en Identity Platform.
2. Si el usuario social no tiene claim ETB o no existe en una allowlist/session validada, bloquear creación.
3. Para usuarios existentes, permitir login social si el UID/email ya está vinculado a cuenta ETB.
4. Implementar linking guiado para `auth/account-exists-with-different-credential`.

Criterio de aceptación:

- Un Google/Apple/Facebook nuevo no registrado por flujo ETB no puede entrar.
- Un usuario ETB existente sí puede vincular proveedor social.

## Fase 10 - Pruebas

Unitarias BFF:

- MS-1 con indicador fidedigno elegible permite.
- MS-1 sin indicador fidedigno bloquea en producción.
- `services[].state.state` no se usa para permitir ni bloquear.
- Sin correo bloquea.
- OTP inválido incrementa intentos.
- OTP correcto emite `verificationToken`.
- Replay token bloqueado.

Frontend/Vitest:

- `RegisterForm` muestra correo enmascarado.
- Mensajes amigables sin errores técnicos.
- Password reset no enumera usuarios.
- Password reset abre action handler autorizado de GCP.

Playwright:

- Registro Hogares completo.
- Registro MiPymes por representante legal.
- Login email link completo.
- Social login registrado.
- Social login no registrado bloqueado.
- `redirect_uri` malicioso bloqueado.

## Fase 11 - Operación Y Observabilidad

Dashboards:

- Tasa de MS-1 éxito/error/latencia.
- Tasa OTP enviado.
- Tasa OTP validado.
- Bloqueos por no elegibilidad MuleSoft.
- Creaciones Identity Platform.
- Errores social login.

Alertas:

- BFF 5xx > 1% en 5 min.
- Latencia p95 BFF > 3s.
- MS-2 timeout > umbral.
- OTP failure rate > 30%.
- Secret próximo a rotar.

## Checklist Para Cierre De Cada Sesión

Antes de terminar una sesión, el agente debe:

1. Actualizar la tabla `Estado De Avance Para Retomar`.
2. Registrar archivos modificados.
3. Registrar comandos ejecutados y resultado.
4. Registrar dudas abiertas.
5. No dejar procesos de dev server corriendo sin avisar.
6. No dejar secretos en diffs.

## Resumen De Archivos A Crear/Modificar

Nuevos:

- `docs/architecture/decisions/0001-idp-spa-stateless-bff-stateful.md`
- `bff/**`
- `src/services/etbAuthApi.ts`
- `src/services/recaptcha.ts`
- tests unitarios BFF
- tests E2E OTP/registro

Modificar:

- `src/App.tsx`
- `src/components/RegisterForm.tsx`
- `src/components/OtpVerificationForm.tsx`
- `src/components/PasswordlessLoginForm.tsx`
- `src/vite-env.d.ts`
- `.env.example`
- `public/config.js`
- `docs/architecture/TECH_README.md`
- `docs/guides/CONFIGURACION-PASO-A-PASO.md`
- `docs/testing/TESTING.md`

## Fuentes Oficiales

- Identity Platform custom tokens: https://cloud.google.com/identity-platform/docs/admin/create-custom-tokens
- Identity Platform blocking functions: https://cloud.google.com/identity-platform/docs/blocking-functions
- Cloud Run VPC connectors: https://cloud.google.com/run/docs/configuring/vpc-connectors
- Cloud Run secrets: https://cloud.google.com/run/docs/configuring/services/secrets
