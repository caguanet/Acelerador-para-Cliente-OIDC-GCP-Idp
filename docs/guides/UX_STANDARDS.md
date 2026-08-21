# UX Standards (Proyecto)

Estándar obligatorio para cambios de UI/UX en este repositorio. Aplica a humanos y a cualquier IA/LLM que colabore en el proyecto.

---

## 1) Objetivo

Garantizar una experiencia:

- intuitiva para usuario final,
- rápida y consistente,
- segura por defecto,
- alineada al branding ETB y al comportamiento real del código.

---

## 2) Principios no negociables

- **Usuario primero:** no exponer errores técnicos (`auth/...`, stack traces, códigos internos) en UI.
- **Claridad accionable:** cada mensaje debe indicar qué pasó y qué puede hacer el usuario.
- **Seguridad sin fricción innecesaria:** proteger flujos OIDC/Firebase sin sacrificar comprensión.
- **Performance consciente:** evitar sobrecarga visual o lógica que degrade TTI/fluidez.
- **Consistencia:** reutilizar componentes/tokens/mensajes existentes antes de crear variantes nuevas.

---

## 3) Estándar de manejo de errores en UI

### 3.1 Regla base

- Mapear errores técnicos a mensajes amigables, breves y orientados a acción.
- No interpolar `error.message` crudo en pantalla.
- Registrar detalles técnicos solo en consola (o trazabilidad interna), nunca para usuario final.

### 3.2 Implementación canónica

- Archivo: `src/utils/authErrors.ts`
- API: `getFriendlyAuthErrorMessage(error, context)`
- Contextos permitidos: `login`, `social`, `recovery`, `otp`

### 3.3 Ejemplos mínimos esperados

- `auth/popup-blocked` → instrucción clara para habilitar ventanas emergentes.
- `auth/network-request-failed` → acción de revisar conexión e intentar nuevamente.
- `auth/too-many-requests` → espera sugerida + nuevo intento.

---

## 4) UX copy (microcopy)

- Lenguaje simple, directo y respetuoso.
- Máximo una idea principal por mensaje.
- Evitar tecnicismos y abreviaturas internas.
- Mantener tono institucional ETB cuando aplique marca pública (ver `BRANDING_ETB.md`).

---

## 5) Criterios de aceptación UX para PRs

Todo cambio de UI debe cumplir:

1. Error states legibles y accionables.
2. Sin exposición de detalles internos sensibles.
3. Contraste y accesibilidad razonables.
4. Sin regresión evidente de performance.
5. Validación mínima ejecutada (`pnpm run test` como base).

---

## 6) Alineación con skills del proyecto

- `etb-brand-brandbook`: identidad visual/verbal ETB.
- `impeccable`: calidad de interfaz, jerarquía, UX y edge cases.
- `security-review`: cuando el cambio toque auth, tokens, secretos o entradas de usuario.
- `vitest-testing-patterns` y/o `playwright-testing`: para cobertura de estados críticos de UX.

---

## 7) Fuente documental relacionada

- [BRANDING_ETB.md](BRANDING_ETB.md)
- [DEVELOPERS.md](DEVELOPERS.md)
- [TESTING.md](../testing/TESTING.md)
- [TECH_README.md](../architecture/TECH_README.md)
