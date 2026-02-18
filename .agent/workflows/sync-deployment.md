---
description: Maintain synchronization between DEPLOY.md and scripts/one-shot-deploy.cmd
---

# Deployment Synchronization Rule

When modifying the deployment process in `DEPLOY.md`, you MUST reflect those changes in `scripts/one-shot-deploy.cmd`.

## Verification Steps
1.  If `DEPLOY.md` commands change (e.g., new `gcloud` flags, new environment variables):
    *   Open `scripts/one-shot-deploy.cmd`.
    *   Apply the same changes to the corresponding section (Infra or Deploy).
2.  Ensure variable names remain consistent.
3.  If a new manual step is added to `DEPLOY.md`, verify if it can be automated in the script.
