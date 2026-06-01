# HU - Construcción MS-4 Registro De Identidad Digital Para IdP GCP

Estado: Borrador formal pendiente de datos obligatorios.  
Fecha de elaboración: 2026-05-07.  
Repositorio fuente: `Acelerador-para-Cliente-OIDC-GCP-Idp`.

Este documento usa la plantilla ETB "Historia de Usuario para Construcción o Cambio de Servicio MuleSoft". El servicio solicitado no existe actualmente entre los servicios MuleSoft conocidos del flujo IdP, por lo que se clasifica como construcción de servicio nuevo.

## 0. Identificación rápida

| Campo | Valor |
| --- | --- |
| Solicitante (nombre / área / rol) | Leandro Garcia / [Pendiente - confirmar área y rol] |
| Fecha de la solicitud (AAAA-MM-DD) | 2026-05-07 |
| Iniciativa asociada (`INI####` o `N-####`) | INI4499 |
| Epic / Feature padre en Azure DevOps | [Pendiente - confirmar] |
| Sponsor de negocio | [Pendiente - confirmar] |
| Aprobador técnico (Líder técnico Tribu Interoperabilidad) | [Pendiente - confirmar] |
| Scrum Master / Gestor de Requerimientos | [Pendiente - confirmar] |
| Fábrica esperada (SQDM / ETB / interna) | [Pendiente - confirmar] |
| Prioridad (1 Crítica · 2 Alta · 3 Media · 4 Baja) | 2 Alta, sugerida por ser bloqueante para registro IdP |
| Fecha estimada de puesta en producción | [Pendiente - confirmar] |
| Sprint / iteration objetivo | [Pendiente - confirmar] |

## 0.5. Tipo de solicitud

### 0.5.1. Marcar el tipo

* [x] A - Construcción de servicio nuevo. El servicio destino no existe actualmente para registrar el alta digital de identidad del cliente validado por OTP antes de crear su identidad en GCP.
* [ ] B - Cambio a servicio existente.
* [ ] C - Híbrido.

### 0.5.2. Identificación del servicio o servicios afectados

No aplica para tipo A. Servicio nuevo propuesto:

| Servicio MuleSoft (kebab-case) | Capa (XAPI/PAPI/SAPI/lib) | Repositorio / ruta | Mule runtime / Java | RAML afectado |
| --- | --- | --- | --- | --- |
| `auth-xapi-services` o `digital-identity-xapi-services`, según estándar ETB vigente | XAPI | `mulesoft/APIS/<pendiente>` | [Pendiente - validar estándar actual] | `src/main/resources/api/auth-xapi.raml` o equivalente |
| `auth-papi-services` o `digital-identity-papi-services`, según estándar ETB vigente | PAPI | `mulesoft/APIS/<pendiente>` | [Pendiente - validar estándar actual] | `src/main/resources/api/auth-papi.raml` o equivalente |
| SAPI de persistencia/alta digital ETB | SAPI | [Pendiente - definir sistema dueño] | [Pendiente] | [Pendiente] |

### 0.5.3. Operaciones / endpoints afectados

| # | Servicio | Método HTTP | Path | Versión actual | Tipo de cambio | Breaking? | CR markdown asociado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Nuevo servicio registro de identidad digital | POST | `/v1/digital-identity/registration` | v1 | Construcción servicio nuevo / contrato / seguridad / auditoría | No, servicio nuevo | No aplica |

### 0.5.4. Naturaleza del cambio por operación

`POST /v1/digital-identity/registration` - Crear una operación MuleSoft que registre en sistemas ETB el alta digital de identidad de un cliente previamente validado por OTP y elegibilidad fidedigna, antes de permitir la creación o habilitación del usuario en GCP Identity Platform.

### 0.5.5. Consumidores de la operación

| Consumidor declarado | `systemId` / `name` esperados | ¿Comunicación previa requerida? |
| --- | --- | --- |
| BFF IdP GCP `idp-bff-service` | `systemId: MIGRACION`, `name: silice`, `source: silice` o los valores definitivos que defina MuleSoft | Sí. Consumidor nuevo del endpoint MS-4. |

### 0.5.6. Reversibilidad del cambio

* [x] El cambio es transparente para consumidores actuales porque crea un endpoint nuevo.
* [ ] El cambio rompe contrato y requiere bump de versión.
* [ ] El cambio rompe contrato y no se puede coexistir.

## 1. Historia de Usuario

### 1.1. Título sugerido

`INI4499 - HU: Construcción servicio MuleSoft para registro de identidad digital de cliente validado por OTP en IdP GCP V1`

### 1.2. Narrativa

Yo como consumidor del IdP ETB basado en GCP Identity Platform  
requiero que se construya un servicio MuleSoft para registrar el alta digital de identidad del cliente después de validar su identidad por OTP  
de tal forma que el BFF del IdP solo cree o habilite usuarios en GCP cuando exista confirmación formal del registro en sistemas ETB.

### 1.3. Contexto de negocio

El IdP ETB requiere registrar clientes Hogares y MiPymes antes de crear su identidad en GCP Identity Platform. El flujo actual cuenta con servicios MuleSoft para consulta de cliente, envío de OTP y validación de OTP, pero falta un servicio que formalice el registro digital posterior a la validación.

Sin este servicio, el BFF del IdP no tiene confirmación transaccional de que el cliente quedó registrado en sistemas ETB. Por seguridad y gobierno de identidad, la creación del usuario en GCP debe ocurrir únicamente después de una respuesta exitosa de este servicio.

Evidencia funcional y técnica:

* El flujo IdP actual es SPA stateless OIDC y debe conservar el diseño documentado en [docs/architecture/TECH_README.md](../architecture/TECH_README.md).
* El código actual de registro ya delega la creación de usuario al BFF mediante `POST /api/customers/register` y la SPA completa sesión con `signInWithCustomToken`. Evidencia: [src/components/RegisterForm.tsx](../../src/components/RegisterForm.tsx) y [server/server.js](../../server/server.js).
* La brecha vigente no es creación desde frontend, sino cerrar el contrato productivo de MS-4 y activarlo antes de crear o habilitar identidades cuando negocio exija alta digital previa.
* El documento de arquitectura del IdP ubica MS-4 como paso obligatorio entre OTP válido y creación del usuario GCP. Evidencia: [docs/architecture/IDP_MULESOFT_GCP_ARCHITECTURE.md](../architecture/IDP_MULESOFT_GCP_ARCHITECTURE.md).

### 1.4. Reglas de negocio relevantes

* La elegibilidad de registro no debe inferirse desde `customer.services[].state.state`, porque ese dato no es fidedigno.
* El servicio MS-4 debe recibir o consultar un indicador fidedigno de elegibilidad definido por MuleSoft/negocio.
* Para Hogares, el registro digital se asocia al documento del cliente validado.
* Para MiPymes, la validación se realiza por documento del representante legal. El NIT puede viajar como dato auxiliar si la UI lo captura y negocio lo exige.
* El OTP debe haber sido validado antes de invocar MS-4.
* El correo usado para OTP y registro debe ser el correo registrado retornado por MuleSoft, no un correo libre digitado por el usuario.
* MS-4 debe ser idempotente para evitar dobles altas por reintentos del BFF.
* Si MS-4 responde error o estado no exitoso, el BFF no debe crear usuario en Identity Platform ni emitir custom token.
* Debe registrarse evidencia de aceptación de términos y tratamiento de datos: versión, fecha/hora, canal, correlación, cliente y consumidor.
* No se deben registrar OTP, contraseñas, tokens, client secrets ni PII completa en logs.

### 1.5. Criterios de aceptación

```gherkin
Escenario: Registro digital exitoso para cliente Hogares
  Dado un cliente Hogares con identidad validada por OTP
  Y un indicador fidedigno de elegibilidad de registro aprobado por MuleSoft
  Cuando el BFF del IdP invoque POST /v1/digital-identity/registration
  Entonces el servicio registra el alta digital de identidad del cliente
  Y responde codigo "200" con id_registro y estado "REGISTRADO".

Escenario: Registro digital exitoso para cliente MiPymes por representante legal
  Dado un representante legal validado por OTP
  Y un flujo de registro MiPymes iniciado desde el IdP
  Cuando el BFF invoque POST /v1/digital-identity/registration con tipo_cliente "MIPYMES"
  Entonces el servicio registra el alta digital asociada al representante legal
  Y conserva el NIT de empresa si fue enviado como dato auxiliar.

Escenario: OTP no validado
  Dado una solicitud sin evidencia de OTP validado
  Cuando se invoque POST /v1/digital-identity/registration
  Entonces el servicio rechaza la solicitud con error funcional
  Y no registra alta digital.

Escenario: Cliente no elegible
  Dado que MuleSoft no confirma elegibilidad fidedigna para registro
  Cuando se invoque POST /v1/digital-identity/registration
  Entonces el servicio responde un error funcional de no elegibilidad
  Y no registra alta digital.

Escenario: Reintento idempotente
  Dado una solicitud previamente registrada con el mismo id_transaccion_otp o correlation_id
  Cuando el BFF reintente POST /v1/digital-identity/registration
  Entonces el servicio retorna el mismo id_registro o un estado equivalente
  Y no duplica el alta digital.
```

### 1.6. Acceptance Criteria final de la HU

Que se construya el servicio MuleSoft `POST /v1/digital-identity/registration` para registrar el alta digital de identidad del cliente validado por OTP antes de la creación de su usuario en GCP Identity Platform.

## 2. Identificación arquitectónica

### 2.1. Capas impactadas

* [x] XAPI - nuevo endpoint consumido por BFF IdP.
* [x] PAPI - orquestación de validaciones y persistencia/llamada a sistema interno.
* [x] SAPI - si existe un sistema fuente para persistir alta digital, auditoría o aceptación legal.
* [ ] Librería compartida.
* [x] RAML nuevo o evolución.

### 2.2. Dominio funcional ETB

Primario: `auth`.

Secundarios/referenciales: `customer`, `otp`, `audit`.

Justificación: el servicio no crea ni modifica el maestro de cliente; registra una identidad digital y su habilitación de acceso al IdP. El cliente ETB viaja como referencia de negocio ya validada por MS-1.

### 2.3. Mapeo TM Forum

| Campo | Valor |
| --- | --- |
| TMF number | TMF720, con referencia secundaria a TMF629 y TMF644 si se persisten acuerdos de privacidad |
| Categoría TMF | Digital Identity Management / Common. Customer Management solo como referencia al cliente existente |
| Nombre funcional canónico | Registrar identidad digital de cliente IdP |
| Versión de implementación | V1.0 |

### 2.3.1. Validación TM Forum del dominio

Conclusión: no se recomienda cerrar esta HU bajo dominio primario `customer` ni bajo naming `customer-registration-*`, salvo que el alcance cambie para crear, actualizar o eliminar el recurso maestro `Customer`.

La razón es que MS-4 se ubica después de MS-1/MS-2/MS-3 y antes de GCP Identity Platform. Su responsabilidad principal es registrar/habilitar una identidad digital para autenticación, no administrar el ciclo de vida comercial del cliente. Por alineación TM Forum, el encaje principal es TMF720 Digital Identity Management. TMF629 Customer Management aplica como referencia porque el cliente ya existe y fue consultado por MS-1. TMF644 Privacy Management aplica solo si el servicio persiste acuerdos/consentimientos de privacidad como recurso propio, no solo si transporta evidencia de aceptación legal para auditoría.

### 2.4. Naming tentativo

| Artefacto | Nombre tentativo | Patrón canónico |
| --- | --- | --- |
| Servicio MuleSoft XAPI | `auth-xapi-services` o `digital-identity-xapi-services` | `{domain}-{layer}-services` |
| Servicio MuleSoft PAPI | `auth-papi-services` o `digital-identity-papi-services` | `{domain}-{layer}-services` |
| Endpoint | `/v1/digital-identity/registration` | `/v{N}/{recurso}[/{verbo}]` |
| Flow principal | `post:/v1/digital-identity/registration:application/json:auth-xapi-config` | `{method}:{path}:application\json:{config-name}` |
| Sub-flow PAPI client | `auth-papi-post-digital-identity-registration-clientSub_Flow` | `{servicio}-papi-{verbo}-{recurso}-clientSub_Flow` |

### 2.5. Reuso esperado

* Reusar patrón de headers de MS-1/MS-2/MS-3 existentes: `Authorization`, `client_id`, `client_secret`, `systemId`, `name`, `source`, `X-CORRELATION-ID`.
* Reusar error handler corporativo del dominio MuleSoft correspondiente.
* Reusar librería/canonical message ETB si aplica para auditoría y trazabilidad.

## 3. Contrato de la API

### 3.1. Headers OAuth obligatorios ETB

* [x] `Authorization: Bearer ...`
* [x] `client_id`, `client_secret`
* [x] `systemId`, `name`
* [x] `X-CORRELATION-ID`
* [x] `source`
* [x] `Content-Type: application/json`

### 3.2. Request

```json
{
  "aplicacion": "silice",
  "id_transaccion_otp": "1dc9f5bd932cc3afbc1e7546c0c09983",
  "tipo_cliente": "HOGARES",
  "tipo_documento": "CC",
  "numero_documento": "9774689",
  "nit_empresa": null,
  "correo_registrado": "cliente@dominio.com",
  "elegibilidad_registro": {
    "fuente": "MULESOFT",
    "estado": "ELIGIBLE",
    "id_validacion": "VAL-..."
  },
  "aceptaciones": {
    "terminos": {
      "aceptado": true,
      "version": "v1.0",
      "fecha_hora": "2026-05-07T10:00:00-05:00"
    },
    "tratamiento_datos": {
      "aceptado": true,
      "version": "v1.0",
      "fecha_hora": "2026-05-07T10:00:00-05:00"
    }
  },
  "proveedor_identidad": "GCP_IDENTITY_PLATFORM",
  "canal": "IDP_WEB",
  "correlation_id": "BFF-20260507-..."
}
```

| Campo | Tipo | Obligatorio | Formato / Validación | Ejemplo |
| --- | --- | --- | --- | --- |
| `aplicacion` | string | Sí | Catálogo MuleSoft | `silice` |
| `id_transaccion_otp` | string | Sí | Debe corresponder a OTP validado | `1dc9f...` |
| `tipo_cliente` | string | Sí | `HOGARES` o `MIPYMES` | `HOGARES` |
| `tipo_documento` | string | Sí | Catálogo documentos | `CC` |
| `numero_documento` | string | Sí | Documento cliente o representante legal | `9774689` |
| `nit_empresa` | string/null | No | Solo MiPymes si aplica | `900123456` |
| `correo_registrado` | string | Sí | Email registrado en MuleSoft | `cliente@dominio.com` |
| `elegibilidad_registro.estado` | string | Sí | Debe ser `ELIGIBLE` | `ELIGIBLE` |
| `aceptaciones.terminos.aceptado` | boolean | Sí | Debe ser `true` | `true` |
| `aceptaciones.tratamiento_datos.aceptado` | boolean | Sí | Debe ser `true` | `true` |
| `proveedor_identidad` | string | Sí | Constante | `GCP_IDENTITY_PLATFORM` |
| `canal` | string | Sí | Canal consumidor | `IDP_WEB` |
| `correlation_id` | string | Sí | Correlación end-to-end | `BFF-...` |

### 3.3. Response esperada

```json
{
  "codigo": "200",
  "mensaje": "Registro digital exitoso",
  "id_registro": "REG-20260507-000001",
  "estado": "REGISTRADO",
  "fecha_registro": "2026-05-07T10:00:02-05:00"
}
```

| Campo | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- |
| `codigo` | string | Código de negocio | `200` |
| `mensaje` | string | Mensaje funcional | `Registro digital exitoso` |
| `id_registro` | string | Identificador de alta digital ETB | `REG-20260507-000001` |
| `estado` | string | Estado del registro | `REGISTRADO` |
| `fecha_registro` | string | Fecha/hora ISO 8601 | `2026-05-07T10:00:02-05:00` |

### 3.4. Códigos de respuesta

| Código | Tipo | Significado | Cuándo se devuelve |
| --- | --- | --- | --- |
| 200 | Business | Registro exitoso | Alta digital creada o reintento idempotente exitoso |
| 400 | HTTP/Business | Request inválido | Faltan campos obligatorios o formato incorrecto |
| 401 | HTTP | No autorizado | Bearer inválido o ausente |
| 403 | HTTP/Business | No autorizado funcionalmente | Cliente no elegible para registro |
| 409 | HTTP/Business | Conflicto idempotente | Ya existe registro con datos incompatibles |
| 422 | Business | OTP no validado o aceptación legal incompleta | No existe evidencia de OTP validado o términos aceptados |
| 500 | HTTP | Error técnico | Error no controlado |
| 504 | HTTP | Timeout | Sistema downstream no respondió |

### 3.5. Idempotencia y versionado

* Idempotencia: obligatoria. Clave sugerida: `id_transaccion_otp` + `tipo_documento` + `numero_documento` + `canal`.
* Versión: `v1`, servicio nuevo.

## 4. Requisitos no funcionales

| Aspecto | Valor |
| --- | --- |
| Latencia P95 objetivo | [Pendiente - sugerido <= 2500 ms sin contar downstream lento] |
| Throughput pico | [Pendiente - estimar con negocio] |
| Volumen diario esperado | [Pendiente] |
| SLA disponibilidad | [Pendiente - sugerido igual a flujo IdP] |
| Política de retry / timeout | Timeout máximo sugerido 8s; retry solo si operación es idempotente |
| Circuit breaker / fallback | Requerido si backend de registro falla |
| Mule runtime objetivo | [Pendiente - validar estándar de fábrica] |
| Plataforma destino | CloudHub 2.0 / RTF / [Pendiente] |
| Workers / vCores estimados | [Pendiente] |
| VPN obligatoria | A validar con conectividad Cloud Run/BFF y MuleSoft |
| PII manejada | Documento, correo, posible NIT, aceptación legal |
| Aplica Ley 2300 | A validar |
| Aplica Habeas Data / ATDP | Sí |
| Aplica regulación sectorial telco | A validar |
| Logging por `X-CORRELATION-ID` | Sí |
| Métricas / alertas particulares | tasa de registro exitoso, fallos de elegibilidad, fallos técnicos, latencia |
| Costo adicional | vCores/workers y conectividad, a validar |

## 5. Discovery

### 5.1. Activación del Discovery

* [x] No existe RAML ni contrato definido para MS-4.
* [x] No hay especificación funcional escrita del alta digital.
* [x] La fuente de elegibilidad fidedigna es desconocida.
* [x] Existe riesgo de PII en logs si no se define redacción.
* [x] Volumen y cardinalidad reales son desconocidos.

### 5.2. Plan de Discovery

| Pregunta | Dónde buscar | Evidencia esperada |
| --- | --- | --- |
| ¿Existe servicio MuleSoft similar de registro/alta digital? | `mulesoft/APIS/`, inventarios internos MuleSoft | Servicio candidato o confirmación de inexistencia |
| ¿Dónde debe persistirse la aceptación legal? | Equipo sistema dueño / repos SAPI | Backend destino y contrato |
| ¿Cuál indicador fidedigno confirma elegibilidad? | Equipo MuleSoft/negocio | Campo o endpoint aprobado |
| ¿Qué códigos de error usan MS-1/MS-2/MS-3? | Logs QA, Postman, RAML reales | Tabla de homologación |
| ¿Qué PII puede registrarse? | Seguridad / Habeas Data ETB | Política de logging y auditoría |

## 6. Consideraciones a validar

| # | Pregunta abierta | Responsable | Antes de qué hito |
| --- | --- | --- | --- |
| 1 | Nombre final del servicio y capa destino | Arquitectura MuleSoft | Antes de Approved |
| 2 | Endpoint y backend donde se persiste el alta digital | MuleSoft / sistema dueño | Antes de Committed |
| 3 | Indicador fidedigno de elegibilidad | Negocio + MuleSoft | Antes de Committed |
| 4 | NFR: latencia, volumen, SLA | Arquitectura / Operación | Antes de Committed |
| 5 | Dominio QA/PROD del IdP/BFF. Estado actual: no definido; usar URL temporal de Cloud Run solo para QA hasta asignar DNS corporativo. | Infra GCP / Seguridad | Antes de pruebas E2E |
| 6 | Confirmar que recuperación MVP con `sendPasswordResetEmail` no requiere trazabilidad MuleSoft ni BFF para este alcance. | Seguridad / Producto IdP | Antes de salida QA |

## 7. Riesgos identificados

| # | Descripción | Probabilidad | Impacto | Mitigación / dueño |
| --- | --- | --- | --- | --- |
| 1 | Crear usuario GCP sin registro ETB si MS-4 no se implementa | Alta | Alto | Bloquear creación hasta MS-4 OK / BFF |
| 2 | Usar `services[].state.state` como elegibilidad aunque no es fidedigno | Alta | Alto | Exigir indicador explícito MuleSoft |
| 3 | Duplicidad de registros por reintentos | Media | Alto | Idempotencia obligatoria |
| 4 | Exposición de PII en logs | Media | Alto | Redacción de campos sensibles |
| 5 | MS-2 interno no accesible desde BFF Cloud Run | Media | Alto | Validar VPC/VPN/NAT |

## 8. Desglose técnico esperado

Yo como consumidor del IdP ETB basado en GCP Identity Platform requiero que se construya un servicio MuleSoft para registrar el alta digital de identidad del cliente validado por OTP de tal forma que incluya:

RAML

* Contrato RAML `POST /v1/digital-identity/registration`.
* Datatypes para request, response y errores funcionales.
* Ejemplos para Hogares, MiPymes, OTP no validado, no elegible e idempotencia.

Experience API

* Implementación del endpoint `POST /v1/digital-identity/registration`.
* Validación de headers ETB obligatorios.
* Transformación canónica de request hacia PAPI.
* Manejo de errores HTTP y business codes.

Process API

* Orquestación de validación de OTP/elegibilidad/registro.
* Validación de idempotencia.
* Llamada a SAPI o sistema destino de registro.
* Homologación de respuesta.

System API

* Persistencia o integración con sistema dueño del alta digital.
* Manejo de timeouts, reintentos idempotentes y errores técnicos.

## 9. Impacto con el IdP GCP

El BFF del IdP debe invocar MS-4 dentro de `POST /api/customers/register` antes de llamar a Admin SDK de Identity Platform.

Orden esperado:

1. BFF valida `verificationToken`.
2. BFF confirma OTP validado.
3. BFF invoca MS-4.
4. Si MS-4 OK, BFF crea usuario GCP.
5. BFF setea custom claims.
6. BFF emite custom token.

## 10. Plan de pruebas

### 10.1. MUnit

* Registro exitoso Hogares.
* Registro exitoso MiPymes por representante legal.
* Request sin OTP validado.
* Cliente no elegible.
* Aceptaciones legales incompletas.
* Reintento idempotente.
* Error downstream.

### 10.2. Postman

* Colección con escenarios de aceptación.
* Variables por ambiente QA/PROD.
* Headers ETB obligatorios.
* Casos negativos documentados.

### 10.3. Integración IdP

* BFF no crea usuario GCP si MS-4 falla.
* BFF crea usuario GCP si MS-4 responde OK.
* Custom token funciona y el IdP emite `id_token`.

## 11. Tasks hijos sugeridos para Azure DevOps

| Task | Descripción | Criterio de cierre |
| --- | --- | --- |
| RAML | Crear contrato RAML V1 | RAML validado y publicado |
| XAPI | Implementar endpoint consumidor | Endpoint responde casos Postman |
| PAPI | Implementar orquestación e idempotencia | MUnit cubre caminos principales |
| SAPI | Implementar persistencia/llamada backend | Integración QA validada |
| Seguridad | Validar OAuth, headers, PII logs | Checklist seguridad cerrado |
| MUnit | Crear pruebas unitarias Mule | Cobertura acordada |
| Postman | Crear colección QA | Colección ejecutada exitosamente |
| IdP BFF | Integrar llamada MS-4 en BFF | No crea usuario sin MS-4 OK |
| Documentación | Hoja de vida / inventario / contrato | Documentos actualizados |

## 12. Definition of Done

* Servicio desplegado en QA.
* RAML publicado.
* Postman validado con BFF IdP.
* MUnit con cobertura acordada.
* Logs sin PII sensible.
* Idempotencia demostrada.
* BFF crea usuario GCP solo con MS-4 OK.
* Documentación actualizada.

## 13. Anexos

* Arquitectura IdP + MuleSoft: [docs/architecture/IDP_MULESOFT_GCP_ARCHITECTURE.md](../architecture/IDP_MULESOFT_GCP_ARCHITECTURE.md)
* ADR IdP SPA + BFF acotado: [docs/architecture/decisions/0001-idp-spa-stateless-bff-stateful.md](../architecture/decisions/0001-idp-spa-stateless-bff-stateful.md)
* Manual operativo: [docs/guides/IDP_GCP_MULESOFT_MANUAL.md](../guides/IDP_GCP_MULESOFT_MANUAL.md)
* Plan de implementación: [docs/planning/IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md](IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md)

## 14. Preguntas pendientes para convertir este borrador en HU final

P2 [DATO FALTANTE] ¿Quiénes son sponsor, aprobador técnico, Scrum Master y fábrica?  
Por qué: campos obligatorios de identificación.

P3 [DATO FALTANTE] ¿Qué sistema ETB debe persistir el alta digital?  
Por qué: define SAPI/backend y alcance real de MS-4.

P4 [DATO FALTANTE] ¿Cuál es el indicador fidedigno de elegibilidad que debe usar MS-4 o el BFF?  
Por qué: ya se descartó `services[].state.state` como fuente de verdad.

P5 [CONFIRMACIÓN] ¿El correo del OTP siempre será el `contactData.email` retornado por MuleSoft?  
Por qué: controla seguridad del registro.

P6 [DATO FALTANTE] ¿Qué versiones legales de términos y tratamiento de datos deben registrarse?  
Por qué: requerimiento de auditoría y Habeas Data.

P7 [PENDIENTE CONFIRMADO] Los dominios QA/PROD de IdP y BFF aún no están definidos.  
Por qué: son necesarios para CORS, GCP authorized domains, reCAPTCHA, providers sociales y pruebas E2E.  
Tratamiento: usar URL temporal de Cloud Run solo en QA; no cerrar configuración PROD hasta que Infra/GCP entregue dominios definitivos.

P8 [DECISIÓN CONFIRMADA] Recuperación de contraseña por MVP con `sendPasswordResetEmail`.  
Por qué: la recuperación queda administrada por Identity Platform/Firebase SDK y no requiere MS-4 ni nuevo endpoint MuleSoft en el alcance inicial.
