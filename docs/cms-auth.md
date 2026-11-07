# CMS login setup (Sveltia CMS + sveltia-cms-auth)

The admin panel lives at `https://orientacionolavarria.com.ar/admin/` (`public/admin/`).
Logging in with GitHub needs a small OAuth relay: the
[sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) Cloudflare Worker.
One-time setup, ~15 minutes. You need the Cloudflare account and a GitHub account.

Sources: https://github.com/sveltia/sveltia-cms-auth (README) ·
https://sveltiacms.app/en/docs/backends/github · https://sveltiacms.app/en/docs/backends ·
https://sveltiacms.app/en/docs/workflows/local

## 1. Deploy the Worker

Either:

- **Dashboard:** open https://github.com/sveltia/sveltia-cms-auth and click
  **Deploy to Cloudflare Workers**; follow the prompts, or
- **CLI:** clone that repo and run `npx wrangler deploy` (via Docker, e.g.
  `docker run --rm -it -v "$PWD":/app -w /app node:lts npx wrangler deploy`).

Note the Worker URL, e.g. `https://sveltia-cms-auth.<SUBDOMAIN>.workers.dev`.

## 2. Create the GitHub App

A **GitHub App** (not an OAuth App) is used so sign-ins can only touch this one repo:
OAuth App scopes (`repo` / `public_repo`) cover every repo the user can push to, while a
GitHub App's user tokens are limited to its permissions and the repos it's installed on.
The worker and CMS treat it the same way (same authorize URL, client ID/secret).

Under the repo owner's account (`ciocchinipablo-netizen`): Settings → Developer settings →
GitHub Apps → **New GitHub App** (https://github.com/settings/apps/new).

| Field | Value |
|---|---|
| Homepage URL | `https://orientacionolavarria.com.ar` |
| Callback URL | `<WORKER_URL>/callback` — e.g. `https://sveltia-cms-auth.<SUBDOMAIN>.workers.dev/callback` |
| Expire user authorization tokens | **off** (otherwise the CMS session dies after 8 h) |
| Webhook → Active | off |
| Repository permissions | **Contents: Read and write** (Metadata: read is automatic); nothing else |
| Where can it be installed | Only on this account |

Create it, copy the **Client ID** (not the App ID), **Generate a new client secret**, then
**Install App** → Only select repositories → `orientacion-olavarria`.

## 3. Set the Worker variables

Cloudflare dashboard → Workers & Pages → the worker → **Settings → Variables**:

| Name | Value | Type |
|---|---|---|
| `GITHUB_CLIENT_ID` | Client ID from step 2 | **Encrypt** (secret) |
| `GITHUB_CLIENT_SECRET` | Client secret from step 2 | **Encrypt** (secret) |
| `ALLOWED_DOMAINS` | `orientacionolavarria.com.ar, *.orientacionolavarria.com.ar` | plain text |

Add the `*.workers.dev` host of the site to `ALLOWED_DOMAINS` too if you want to log in
from a preview URL before the custom domain is live (comma-separated hostnames;
`*.example.com` does not match the bare `example.com`). Save and deploy.

CLI alternative: `wrangler secret put GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, and `wrangler deploy --var "ALLOWED_DOMAINS:..."`. Keep both client values as secrets: plain dashboard vars are wiped by the next CLI deploy.

## 4. Point the CMS at the Worker

In `public/admin/config.yml` replace the placeholder:

```yaml
backend:
  base_url: https://sveltia-cms-auth.<SUBDOMAIN>.workers.dev   # no trailing path
```

Commit and push; the site rebuilds.

## 5. Pablo: access, login, publishing

- **Repo access is required.** Pablo's GitHub user must have **Write** (or Maintain/Admin)
  on `ciocchinipablo-netizen/orientacion-olavarria`. If the repo is his own account he
  already has it; otherwise add him under repo **Settings → Collaborators**.
  Read-only users cannot sign in.
- **Login:** open `https://orientacionolavarria.com.ar/admin/` → **Sign In with GitHub** →
  authorize the app (first time only).
- **Write/publish:** **Artículos → Nuevo** → fill Título, Fecha, Categoría, Resumen,
  optional Imagen de portada, Contenido → **Guardar**. Saving commits directly to `main`;
  Cloudflare rebuilds and the article is live in a couple of minutes.
- **Borrador:** turn it on to save without publishing; turn it off and save again to publish.
- The UI language follows the browser; to force Spanish: avatar (top right) →
  **Settings** → Language.

Fallback login without the Worker: **Sign In with Token** using a GitHub personal access
token (fine-grained: *Contents: read & write* on this repo; classic: `repo` scope).

## Local editing (developers, no auth needed)

1. Start the dev server (`npm run dev` via Docker).
2. In Chrome/Edge (Chromium only — not Firefox/Safari) open
   `http://localhost:<port>/admin/index.html`.
3. Click **Work with Local Repository** and select the repo root.

Changes are written to the working tree; commit and push with git yourself.
