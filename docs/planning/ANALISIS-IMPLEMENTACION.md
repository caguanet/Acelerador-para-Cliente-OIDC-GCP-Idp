# Análisis de implementación — OIDC IdP en GCP

**Rol:** Product Owner  
**Audiencia:** Equipo técnico (DevOps, desarrollo, seguridad)  
**Objetivo:** Definir el alcance de la implementación en GCP y las configuraciones requeridas, materializadas en Historias de Usuario listas para desarrollo.

---

## 1. Contexto y alcance

### 1.1 Qué se implementa

- **Proveedor de identidad OIDC (IdP)** white-label que actúa como intermediario entre aplicaciones cliente y **GCP Identity Platform (Firebase Auth)**.
- **Flujo:** OIDC implícito (sin backend de intercambio de tokens); el IdP devuelve el `id_token` en el fragmento de la URL (`#id_token=...`).
- **Entorno objetivo:** Despliegue en **Google Cloud Run** (serverless), con credenciales gestionadas en **Secret Manager** e imágenes en **Artifact Registry**.

### 1.2 Fuera de alcance (en esta entrega)

- Desarrollo del código de la aplicación IdP (ya existe en el repositorio).
- Despliegue de clientes OIDC de negocio (solo se considera mock/cliente de prueba para validación).
- Personalización de marca (white-label) se considera configuración posterior; no es bloqueante para el go-live.

### 1.3 Valor de negocio

- **Seguridad:** Identidad centralizada en GCP, sin exponer credenciales en código; validación estricta de orígenes (`redirect_uri`).
- **Operación:** Infraestructura serverless, sin servidores que administrar; despliegue repetible mediante script y documentación.
- **Integración:** Los socios actúan como OIDC clients (Relying Parties) redirigiendo a esta instancia; el cliente es dueño del IdP en su propia cuenta GCP.

---

## 2. Stakeholders y responsabilidades

| Rol | Responsabilidad típica |
|-----|-------------------------|
| **DevOps / Infraestructura** | Proyecto GCP, APIs, Identity Platform, Cloud Run, Artifact Registry, Secret Manager, IAM. |
| **Seguridad** | API Key, OAuth, restricciones de dominio y de API; ausencia de secretos en código. |
| **Desarrollador** | Build, Dockerfile, variables de entorno; integración con el script de despliegue. |
| **QA / Operaciones** | Validación E2E, runbook, troubleshooting, despliegue de nuevas versiones. |

Las HUs están redactadas para que cualquiera de estos roles pueda ejecutarlas con la definición técnica proporcionada.

---

## 3. Dependencias y orden de ejecución

```
HU-01 (Proyecto GCP + Identity Platform)
    ├── HU-02 (Credenciales y seguridad)
    └── HU-03 (Infraestructura: SA, Artifact Registry, Secret Manager)
              │
              └── HU-04 (Build + despliegue Cloud Run)
                        │
                        └── HU-05 (Integración post-despliegue: dominios, orígenes, login)
                                  │
                                  └── HU-06 (Validación E2E, runbook, operación)
```

- **HU-01** es prerrequisito de todo (proyecto y Identity Platform).
- **HU-02** y **HU-03** pueden ejecutarse en paralelo tras HU-01.
- **HU-04** requiere HU-02 y HU-03 (credenciales listas y secretos/registro disponibles).
- **HU-05** y **HU-06** son secuenciales tras tener el servicio desplegado.

---

## 4. Estimación y criterio de tamaño

- **Criterio:** Cada HU representa **máximo 3–4 jornadas** de trabajo (1 persona: DevOps/desarrollador).
- **Total estimado:** 6 HUs × ~3,5 j ≈ **21 jornadas** (aprox. 4–5 sprints de 1 semana con 1 FTE).
- Si el equipo tiene más de un responsable (p. ej. uno en seguridad y otro en infra), HU-02 y HU-03 en paralelo reducen el tiempo total.

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Políticas de organización GCP (p. ej. Domain Restricted Sharing) impiden `allow-unauthenticated` en Cloud Run. | Documentado en DEPLOY.md; revisar políticas antes de HU-04; excepción o proyecto en folder sin restricción. |
| Token Service API no habilitada o no permitida en la API Key → login “correcto” pero sin emisión de token. | HU-02 exige explícitamente Identity Toolkit API + Token Service API; checklist de aceptación. |
| Secretos en Secret Manager con espacios/saltos de línea → errores tipo "Illegal url for new iframe". | HU-03 indica crear/actualizar sin espacios al final; documentado en CONFIGURACION-PASO-A-PASO. |
| Dominio de Cloud Run no agregado a Authorized domains → `auth/unauthorized-domain`. | HU-05 incluye paso obligatorio; runbook en HU-06 refuerza el checklist post-deploy. |

---

## 6. Resumen de Historias de Usuario

| ID | Título | Estimación | Entregable principal |
|----|--------|------------|------------------------|
| [HU-01](HU-01-proyecto-gcp-identity-platform.md) | Preparación del proyecto GCP e Identity Platform | 3–4 j | Proyecto listo, Email/Password activo, dominios autorizados (localhost), IAM verificado. |
| [HU-02](HU-02-credenciales-seguridad.md) | Configuración de credenciales y seguridad (API Key, OAuth) | 3–4 j | API Key restringida (referrers + APIs); OAuth listo para dev/prod si aplica; sin secretos en repo. |
| [HU-03](HU-03-infraestructura-despliegue.md) | Infraestructura base para despliegue | 3–4 j | SA `idp-service-sa`, Artifact Registry, Secret Manager con FIREBASE_* y permisos correctos. |
| [HU-04](HU-04-build-despliegue-cloud-run.md) | Build de imagen y despliegue del IdP en Cloud Run | 3–4 j | Imagen en Artifact Registry, servicio `idp-service` en Cloud Run con secretos inyectados. |
| [HU-05](HU-05-integracion-post-despliegue.md) | Integración y configuración post-despliegue | 3–4 j | Dominio Cloud Run en Authorized domains; API Key y OAuth de producción; login E2E funcionando. |
| [HU-06](HU-06-validacion-operacion.md) | Validación E2E, runbook y operación | 3 j | Runbook, E2E contra Cloud Run, tabla de troubleshooting, documentación de deploy-cloudrun-only. |

---

## 7. Definición funcional vs. técnica en cada HU

Cada HU incluye:

- **Definición funcional:** Formato “Como … quiero … para que …” y criterios de aceptación desde el punto de vista de negocio (qué se entrega y por qué).
- **Definición técnica:** Alcance, tareas concretas (comandos, consolas, archivos), criterios de aceptación técnicos y referencias a CONFIGURACION-PASO-A-PASO.md, DEPLOY.md y scripts.

Con esto el equipo técnico tiene tanto el “qué” y “para qué” (PO) como el “cómo” (implementación en GCP y configuraciones).

---

## 8. Referencias de documentación

- [CONFIGURACION-PASO-A-PASO.md](../../CONFIGURACION-PASO-A-PASO.md) — Configuración explícita local y despliegue.
- [DEPLOY.md](../../DEPLOY.md) — Despliegue en producción y resolución de problemas.
- [README.md](README.md) — Índice de HUs y convenciones.
- Scripts: `scripts/one-shot-deploy.cmd`, `scripts/deploy-cloudrun-only.cmd`.
