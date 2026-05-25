# ADR 0001 - IdP SPA Stateless + BFF Stateful Acotado

Fecha: 2026-05-07  
Estado: Aceptado

## Contexto

El producto es un Identity Provider white-label sobre GCP Identity Platform / Firebase Auth. El contrato vigente hacia las aplicaciones cliente OIDC se mantiene como SPA stateless con OIDC Implicit Flow, runtime configuration por `window.APP_CONFIG` y validacion estricta de `redirect_uri` contra `allowedOrigins`.

La integracion con MuleSoft agrega requisitos que no deben ejecutarse desde el navegador:

- Consultar cliente y elegibilidad de registro con credenciales MuleSoft.
- Enviar y validar OTP contra servicios ETB.
- Registrar el alta digital ETB en MS-4 antes de crear o habilitar la identidad en GCP.
- Crear usuarios, asignar custom claims y emitir custom tokens con Firebase Admin SDK.
- Persistir sesiones OTP, auditoria y evidencia legal con TTL, idempotencia y trazabilidad.

## Decision

Se conserva el IdP como SPA stateless y OIDC Implicit Flow hacia los Relying Parties. El BFF Cloud Run se incorpora como componente stateful acotado exclusivamente para orquestar MuleSoft, OTP, MS-4, auditoria y Firebase Admin SDK.

El BFF no reemplaza el contrato OIDC del producto, no introduce Authorization Code + PKCE para los clientes actuales y no maneja sesiones OIDC de los Relying Parties. La emision final hacia el cliente sigue ocurriendo desde el IdP SPA mediante `id_token` en el fragmento de redireccion, despues de obtener un token valido de Identity Platform.

## Reglas Vinculantes

- El navegador no recibe secretos MuleSoft, bearer tokens, service account keys ni credenciales de Admin SDK.
- El BFF usa Secret Manager para secretos y Firestore para `otp_sessions`, `accept_logs`, `registration_events` y auditoria.
- MS-4 es bloqueante para produccion si ETB exige alta digital previa: si MS-4 falla, el BFF no crea usuario en Identity Platform ni emite custom token.
- La elegibilidad de registro debe venir de un indicador fidedigno de MuleSoft o un servicio dedicado; no se infiere desde `customer.state` ni desde `services[].state.state`.
- El OTP se envia al correo registrado retornado por MuleSoft. En produccion el usuario no elige un correo alterno para recibir OTP.
- Google, Apple y Facebook requieren control de alta social con blocking functions (`beforeCreate` / `beforeSignIn`) para impedir usuarios sin validacion ETB.
- Los custom claims deben ser minimos y no incluir PII completa; usar hashes cuando aplique.
- Cualquier cambio a Authorization Code + PKCE, backend OIDC stateful o un nuevo contrato hacia Relying Parties requiere un ADR nuevo y actualizacion de arquitectura.

## Consecuencias

### Positivas

- Se mantiene la simplicidad del IdP SPA y compatibilidad con clientes OIDC actuales.
- MuleSoft, OTP, MS-4 y Admin SDK quedan dentro de un limite de confianza servidor.
- El flujo de registro gana idempotencia, auditoria y control de secretos.
- La arquitectura puede evolucionar a controles enterprise sin cambiar de inmediato el contrato OIDC externo.

### Costos

- Se agrega un servicio Cloud Run adicional con despliegue, observabilidad y seguridad propios.
- Firestore se vuelve dependencia operacional para OTP y auditoria.
- La salida a produccion queda bloqueada hasta definir el indicador fidedigno de elegibilidad MuleSoft y el contrato MS-4.

## Alternativas Evaluadas

### Solo SPA llamando MuleSoft

Rechazada. Expondria secretos MuleSoft y no podria usar Firebase Admin SDK de forma segura.

### Migrar todo a Authorization Code + PKCE con backend OIDC stateful

Rechazada para el alcance actual. Cambia el contrato de producto documentado, aumenta complejidad y requiere decision de arquitectura separada.

### Crear usuario directamente desde React

Rechazada para el flujo ETB. Evita MS-4, dificulta auditoria y permite altas antes de la confirmacion formal del registro en sistemas ETB.

## Documentos Relacionados

- [TECH_README.md](../TECH_README.md)
- [IDP_MULESOFT_GCP_ARCHITECTURE.md](../IDP_MULESOFT_GCP_ARCHITECTURE.md)
- [IDP_GCP_MULESOFT_MANUAL.md](../../guides/IDP_GCP_MULESOFT_MANUAL.md)
- [IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md](../../planning/IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md)
- [HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md](../../planning/HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md)
