# Contact form runbook

The form (`src/components/ContactForm.astro`, `/contacto/`) posts to our own Worker (`worker/index.ts`, `POST /api/contacto`). Config: Turnstile site key (public, hardcoded in the component), `TURNSTILE_SECRET_KEY` (runtime secret), `send_email` binding + vars in `wrangler.jsonc`. No build variables are needed.

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
2. The **site key** is public and hardcoded in `src/components/ContactForm.astro`; update it there if the widget is recreated. `PUBLIC_TURNSTILE_SITE_KEY` only overrides it (local testing).
3. Copy the **secret key** → Worker secret:
   `npx wrangler secret put TURNSTILE_SECRET_KEY`, or Dashboard → Worker → **Settings → Variables & Secrets** → Add → type Secret.

Server-side validation: <https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>. Tokens are single-use and valid for 5 minutes; the form resets the widget after each attempt.
Turnstile has a free plan.

## 3. Testing

**Locally** (Worker plus built site):

1. Put Turnstile's always-pass test keys in place:
   - `.env`: `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`
   - `.dev.vars`: `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`
   Source: <https://developers.cloudflare.com/turnstile/troubleshooting/testing/>
2. `npm run build`, then `npx wrangler dev`, then open `/contacto/` and submit.
3. `wrangler dev` **simulates** `send_email`: nothing is delivered, and the email is printed to the terminal and saved to a local file. Setting `"remote": true` on the binding sends real email from local dev. Source: <https://developers.cloudflare.com/email-service/observability/local-development/sending/>
4. `astro dev` alone does not run the Worker, so `/api/contacto` returns 404 there.

**Production:**

- Submit `/contacto/` with your own email. Expect the "¡Gracias!…" message, a mail in Pablo's inbox from `web@…`, and "Responder" addressed to you.
- If the mail doesn't arrive: Worker → Logs. Look for `contact: send_email failed <code>` (e.g. `E_SENDER_NOT_VERIFIED`, `E_RECIPIENT_NOT_ALLOWED`) or `contact: turnstile rejected`.
