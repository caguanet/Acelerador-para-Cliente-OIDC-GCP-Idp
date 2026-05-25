#!/usr/bin/env bash
set -euo pipefail

# Baseline de agentes soportados en este proyecto.
AGENTS=(cursor claude-code antigravity codex opencode)

# Baseline de skills aprobadas para este repositorio (scope: project-only).
SKILLS=(
  "patricio0312rev/skills@oauth2-oidc-implementer"
  "affaan-m/everything-claude-code@security-review"
  "lyndonkl/claude@security-threat-model"
  "firebase/agent-skills@firebase-auth-basics"
  "sickn33/antigravity-awesome-skills@gcp-cloud-run"
  "erichowens/some_claude_skills@vitest-testing-patterns"
  "laurigates/claude-plugins@playwright-testing"
  "autohandai/community-skills@typescript-refactoring-patterns"
  "pbakaus/impeccable@impeccable"
  "softaworks/agent-toolkit@react-dev"
  "caidanw/skills@typescript-refactoring"
  "mrgoonie/claudekit-skills@web-testing"
)

echo "Instalando baseline de skills (scope: project-only)..."
echo "Agentes objetivo: ${AGENTS[*]}"
echo

for skill in "${SKILLS[@]}"; do
  echo "-> Instalando ${skill}"
  pnpm dlx skills add "${skill}" --agent "${AGENTS[@]}"
done

echo
echo "Validación final (skills instaladas en este proyecto):"
pnpm dlx skills ls
