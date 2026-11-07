# Forms runbook

| Form | Component | Backend | Config |
|---|---|---|---|
| Contacto (`/contacto/`) | `src/components/ContactForm.astro` | our Worker, `worker/index.ts` → `POST /api/contacto` | `PUBLIC_TURNSTILE_SITE_KEY` (build var), `TURNSTILE_SECRET_KEY` (secret), `send_email` binding + vars in `wrangler.jsonc` |
| Newsletter (`/blog/`) | `src/components/NewsletterForm.astro` | Buttondown | `PUBLIC_BUTTONDOWN_USER` (build var) |

`PUBLIC_*` values are inlined into the HTML at **build time**. If one is missing the build still succeeds and logs a `[ContactForm]` / `[NewsletterForm]` warning, but that form won't work.

## Contact form flow

1. The visitor fills the form. The Turnstile widget adds a `cf-turnstile-response` token.
2. With JS, the form is sent via `fetch` and the Worker answers JSON (`{ok:true}` / `{ok:false,error}`). The result is shown in place.
   Without JS fetch, a normal POST gets a `303` redirect to `/contacto/?enviado=1` or `?error=1`. Turnstile itself needs JS, so visitors with JS fully disabled can't send the form; a `<noscript>` note points them to WhatsApp/Instagram.
3. The Worker validates the fields (with length caps) and checks the token with Turnstile `siteverify`. It then emails Pablo through the `send_email` binding: From `web@orientacionolavarria.com.ar`, Reply-To = the visitor, subject "Nueva consulta desde la web". Pablo can just hit "Responder".

Sending only to **verified destination addresses** of our own account is free on all plans, including Workers Free with only Email Routing set up. Sending to arbitrary recipients would need Workers Paid. Source: <https://developers.cloudflare.com/email-service/platform/pricing/>.
API used: structured `env.EMAIL.send({ to, from, replyTo, subject, text })` (no raw MIME). Source: <https://developers.cloudflare.com/email-service/api/send-emails/workers-api/>.

## 1. Email Routing (one-time)

The domain must use Cloudflare DNS.

1. Dashboard → **Compute → Email Service → Email Routing → Onboard Domain** → pick `orientacionolavarria.com.ar` → Done. This adds Cloudflare MX (and SPF/DKIM) records.
   **Warning:** Email Routing takes over inbound mail for the domain via its MX records. If the domain already receives mail at another provider (Google Workspace, Zoho, the registrar's mailbox…), enabling it conflicts with that setup. Check the existing MX records first.
2. **Destination Addresses** → add **Pablo's email** → he clicks "Verify email address" in the email Cloudflare sends. Delivery fails until this is done.
3. Optional: add a routing rule so mail to `web@orientacionolavarria.com.ar` (e.g. bounces) also forwards to Pablo.

Source: <https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/>

## 2. Turnstile (one-time)

1. Dashboard → **Turnstile → Add widget**. Name it "Orientación Olavarría contacto". Hostnames: `orientacionolavarria.com.ar` (also `www.` and the `*.workers.dev` preview host if those will be used). Widget mode: Managed.
2. Copy the **site key** → Workers Builds build variable `PUBLIC_TURNSTILE_SITE_KEY` (see section 4).
3. Copy the **secret key** → Worker secret:
   `npx wrangler secret put TURNSTILE_SECRET_KEY`, or Dashboard → Worker → **Settings → Variables & Secrets** → Add → type Secret.

Server-side validation: <https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>. Tokens are single-use and valid for 5 minutes; the form resets the widget after each attempt.
Turnstile has a free plan.

## 3. Buttondown (newsletter)

1. Create an account at <https://buttondown.com> (ideally with Pablo's email).
2. The username is the `<username>` in `buttondown.com/<username>`. It also appears in **Settings → Embedding** in the form action `https://buttondown.com/api/emails/embed-subscribe/<username>`.
3. Set it as the build variable `PUBLIC_BUTTONDOWN_USER`.

This is a plain HTML POST. Buttondown's docs say not to call `embed-subscribe` via `fetch`, so the visitor lands on Buttondown's confirmation page, and new subscribers get a confirmation email.
Free plan: first 100 subscribers. Sources: <https://buttondown.com/pricing>, <https://docs.buttondown.com/building-your-subscriber-base>.

## 4. Cloudflare build variables

`PUBLIC_TURNSTILE_SITE_KEY` and `PUBLIC_BUTTONDOWN_USER` must be **build** variables. Runtime "Variables & Secrets" are not visible to `astro build`.
Dashboard → Worker → **Settings → Build → Build variables and secrets** → add both, then trigger a new build.
Source: <https://developers.cloudflare.com/workers/ci-cd/builds/configuration/>

`TURNSTILE_SECRET_KEY` is the opposite: a **runtime** secret (section 2), never a build variable.

## wrangler.jsonc changes

Merge into the existing `wrangler.jsonc`. Keep `name`, `compatibility_date`, `assets.directory` and `not_found_handling` as they are. Replace `PABLO_EMAIL` with Pablo's verified destination address (in both places).

```jsonc
{
  "main": "./worker/index.ts",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"]
  },
  "send_email": [
    { "name": "CONTACT_EMAIL", "destination_address": "PABLO_EMAIL" }
  ],
  "vars": {
    "CONTACT_TO": "PABLO_EMAIL",
    "CONTACT_FROM": "web@orientacionolavarria.com.ar"
  }
}
```

- `run_worker_first: ["/api/*"]` runs the Worker only for `/api/*`. All other requests hit static assets directly (free, no Worker invocation). Source: <https://developers.cloudflare.com/workers/static-assets/binding/>
- `destination_address` locks the binding to Pablo's inbox, so a bug can't email anyone else. Source: <https://developers.cloudflare.com/email-service/configuration/send-bindings/>
- `TURNSTILE_SECRET_KEY` is a secret, so it is not in `vars`.

## 5. Testing

**Locally** (Worker plus built site):

1. Put Turnstile's always-pass test keys in place:
   - `.env`: `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`
   - `.dev.vars`: `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`
   Source: <https://developers.cloudflare.com/turnstile/troubleshooting/testing/>
2. `npm run build`, then `npx wrangler dev`, then open `/contacto/` and submit.
3. `wrangler dev` **simulates** `send_email`: nothing is delivered, and the email is printed to the terminal and saved to a local file. Setting `"remote": true` on the binding sends real email from local dev. Source: <https://developers.cloudflare.com/email-service/observability/local-development/sending/>
4. `astro dev` alone does not run the Worker, so `/api/contacto` returns 404 there.

**Production:**

- Build log: no `[ContactForm]` / `[NewsletterForm]` warnings.
- Submit `/contacto/` with your own email. Expect the "¡Gracias!…" message, a mail in Pablo's inbox from `web@…`, and "Responder" addressed to you.
- If the mail doesn't arrive: Worker → Logs. Look for `contact: send_email failed <code>` (e.g. `E_SENDER_NOT_VERIFIED`, `E_RECIPIENT_NOT_ALLOWED`) or `contact: turnstile rejected`.
- Newsletter: subscribe from `/blog/` with a test address. Expect the Buttondown confirmation page and email, then delete the test subscriber.
