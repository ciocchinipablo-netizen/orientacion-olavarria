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

## 2. Create the GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
(https://github.com/settings/applications/new). Create it under the account that owns
the repo (`ciocchinipablo-netizen`) or any account — it only needs to exist once.

| Field | Value |
|---|---|
| Application name | `Sveltia CMS Authenticator` (anything) |
| Homepage URL | `https://orientacionolavarria.com.ar` (anything) |
| Authorization callback URL | `<WORKER_URL>/callback` — e.g. `https://sveltia-cms-auth.<SUBDOMAIN>.workers.dev/callback` |

Register, then **Generate a new client secret**. Copy the **Client ID** and **Client secret**.

## 3. Set the Worker variables

Cloudflare dashboard → Workers & Pages → the worker → **Settings → Variables**:

| Name | Value | Type |
|---|---|---|
| `GITHUB_CLIENT_ID` | Client ID from step 2 | plain text |
| `GITHUB_CLIENT_SECRET` | Client secret from step 2 | **Encrypt** (secret) |
| `ALLOWED_DOMAINS` | `orientacionolavarria.com.ar, *.orientacionolavarria.com.ar` | plain text |

Add the `*.workers.dev` host of the site to `ALLOWED_DOMAINS` too if you want to log in
from a preview URL before the custom domain is live (comma-separated hostnames;
`*.example.com` does not match the bare `example.com`). Save and deploy.

CLI alternative: `npx wrangler secret put GITHUB_CLIENT_SECRET` (and the others as vars).

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
