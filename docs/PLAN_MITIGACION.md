# Plan de trabajo: mitigaciones de riesgos (sin romper comportamiento)

Objetivo: **reducir riesgo operativo y de modelo de amenazas** con cambios incrementales y **puertas de verificación explícitas** tras cada paso.

## Principios (obligatorios)

1. **No cambiar el flujo OIDC documentado** (implicit flow SPA stateless, según [TECH_README.md](../architecture/TECH_README.md)) salvo proyecto aparte acordado y documentación actualizada.
2. **Cada fase debe cerrarse** con la verificación definida aquí antes de pasar a la siguiente.
3. **Si algo rompe**: revertir solo el último cambio y documentar causa en [CHANGELOG.md](../CHANGELOG.md) o nota temporal en esta sección hasta root-cause.
4. **Producción vs experimentación**: encabezados HTTP (CSP, etc.), WAF/CDN y cambios de arquitectura van en **staging primero**.

## Verificación base (automática + rápida)

Tras cualquier cambio de código/config de build ejecutar desde la raíz del repo:

```bash
npm run verify:regression
```

Incluye ahora mismo: `scripts/verify-skills-lock.mjs` (omitido como **fallo de salida ≠0** sólo cuando falta `.agents/skills`; use `STRICT_SKILLS_LOCK=1` en CI si versiona esa carpeta y quiere bloque fuerte).

Sincronizar hashes después de cambiar skills locales:

```bash
npm run skills:refresh-lock
```

E2E (requiere Firebase en `.env` según [.env.example](../.env.example)):

```bash
npm run test:e2e:ci   # sólo Chromium — más rápido en pipelines locales
VERIFY_E2E=1 npm run verify:regression   # ejecuta todas las vistas Playwright configuradas
```

**Criterios de éxito:** `build` y pruebas unitarias en verde. E2E opcional ante ausencia de credenciales válidas ([TESTING.md](../testing/TESTING.md), workflow `e2e-manual.yml`).

Manual mínimo adicional ante cambios de auth o redirects:

1. Login feliz desde cliente simulador ([DEVELOPERS.md](../guides/DEVELOPERS.md) / `npm run dev:simulation`).
2. Intento `redirect_uri` no autorizado debe fallar igual que antes (regresión de seguridad más crítica que la regresión funcional superficial).

---

## Fase A — Gobierno del repo y agentes (**riesgo muy bajo**)

**Alcance:** procesos que no modifican código de aplicación ejecutado por usuarios.

| Acción | Para qué mitiga |
|--------|----------------|
| Registrar en git el baseline de `.agents/skills/` y revisar contra [skills-lock.json](../skills-lock.json) | Divergencias entre desarrolladores/CI |
| Acordar rama/strategy tras `scripts/setup-skills.sh` únicamente con revisión previa del lockfile | Skills no auditadas |
| Revisión periódica de [AGENTS.md](../AGENTS.md) | Contradicciones skills ↔ diseño |

**Verificación:** `npm run verify:regression` (sin código tocado tras solo git). Opcionalmente `VERIFY_E2E=1` si también se modificó algo de tooling que afecte tests.

---

## Fase B — Contexto UX para agentes (impeccable) (**riesgo muy bajo**)

**Alcance:** documentación exclusiva para flujos de diseño/UI con agentes.

| Acción | Para qué mitiga |
|--------|----------------|
| Mantener actualizado el [PRODUCT.md](../PRODUCT.md) (propósito/usuarios, sin sustituir `APP_CONFIG`) | Briefings genéricos o inventados |
| Opcional: `DESIGN.md` con decisión sobre tipografía/color si el equipo lo necesita consistente más allá de runtime | Incoherencia visual en herramientas de diseño |

**Verificación:** no aplica compilación especial; ejecutar igual `npm run verify:regression` si se tocaron otros archivos durante la misma tarea.

---

## Fase C — Operaciones GCP (**riesgo bajo**, fuera del bundle JS)

Mitiga: claves públicas sobre-permisivas y dominios equivocados según [DEVELOPERS.md](../guides/DEVELOPERS.md) y [TECH_README.md](../architecture/TECH_README.md).

Checklist reproducible antes de cada despliegue o trimestral:

- [ ] `APP_CONFIG.allowedOrigins` completo para **todos** los `redirect_uri` legítimos entre entornos.
- [ ] API key de GCP: restricciones de **referrers** sólo dominios conocidos por entorno.
- [ ] API key: sólo APIs necesarias (**Identity Toolkit**, **Token Service** salvo otros acordados).
- [ ] Revisión de roles IAM y Secret Manager conforme [DEPLOY.md](../guides/DEPLOY.md).
- [ ] Si hay exposición ampliamente pública evaluar roadmap hacia CDN + Cloud Armor ([TECH_README.md](../architecture/TECH_README.md)).

**Verificación:** sin cambiar artefactos; checklist firmado/offline está bien. Cambios sólo configuración GCP no requieren `verify:regression` salvo cambien headers del edge.

---

## Fase D — Hardening de aplicación (**riesgo medio**: requiere staging)

Ejecutar **solo después** de A–C estable y siempre detrás del mismo script de verificación.

| Acción | Mitiga | Precaución |
|--------|--------|------------|
| Auditoría manual de logs consola/red en modo prod build | Fuga accidental de tokens / PII ([TECH_README.md](../architecture/TECH_README.md)) | No remover logs útiles de diagnóstico dev sin consentimiento equipo |
| Revisión de dependencias vuln conocidas (`npm audit`, política equipo) | CVE en cadena frontend | Resolver sin saltos majors que rompan React 18 hasta plan |
| Encabezados de seguridad (HSTS solo si TLS gestionado; CSP estricto) | XSS después de obtener sesión implicit | CSP puede romper `config.js` inline o firebase si es demasiado estricto |

**Puerta:** implementar CSP u otros headers sólo tras prueba en staging con checklist de vistas: landing, modal login, redirect error, cliente simulado.

**Verificación:** `VERIFY_E2E=1 npm run verify:regression` + navegador manual contra staging.

---

## Fase E — Evolución arquitectónica opcional (**alto alcance**, no obligatoria en este plan)

Si el nivel de cumplimiento o el modelo de amenazas exige superar implicit flow mitigándolo en protocolo:

- Diseñar fase técnica con **authorization code + PKCE** y/o **BFF** manteniendo contratos con RP documentados.

**Puerta:** ADR nuevo, roadmap, feature flags si aplica — explícitamente fuera del alcance "sin afectar funcionamiento" hasta aprobación de producto.

---

## Estado de seguimiento

| Fase | Estado sugerido | Fecha última verificación |
|------|-----------------|----------------------------|
| A | Scripts + lock alineados; CI base en `verify:regression`; versionar `.agents/skills` y activar variable `STRICT_SKILLS_LOCK` si corresponde | — |
| B | **PRODUCT.md** y **DESIGN.md** radicados; mantener texto al día | — |
| C | Ejecutar checklist GCP manualmente ante cada release | — |
| D | Pendiente sólo cuando se disponga staging | — |
| E | Backlog opcional PKCE/BFF | — |

_(Completado por el equipo; este bloque puede migrarse al tablero interno cuando exista uno.)_

---

## Referencias cruzadas

- [AGENTS.md](../AGENTS.md) — prioridad de fuentes para agentes.
- [TESTING.md](../testing/TESTING.md) — pirámide y calidad previa al release.
