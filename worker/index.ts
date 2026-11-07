/**
 * Worker entry. Runs only for /api/* (assets.run_worker_first); everything else
 * is served from static assets. See docs/forms.md for setup and wrangler config.
 *
 * Binding types are declared locally (structurally compatible with
 * @cloudflare/workers-types) so this file typechecks without extra deps.
 */

interface AssetsBinding {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
}

interface EmailAddress {
  email: string;
  name: string;
}

interface SendEmailBinding {
  send(message: {
    to: string | EmailAddress;
    from: string | EmailAddress;
    replyTo?: string | EmailAddress;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}

export interface Env {
  ASSETS: AssetsBinding;
  /** send_email binding; its destination_address pins delivery to Pablo's verified inbox. */
  CONTACT_EMAIL: SendEmailBinding;
  /** Pablo's verified Email Routing destination address (same as the binding's destination_address). */
  CONTACT_TO: string;
  /** Sender on the site's domain, e.g. web@orientacionolavarria.com.ar. */
  CONTACT_FROM: string;
  /** Secret: wrangler secret put TURNSTILE_SECRET_KEY */
  TURNSTILE_SECRET_KEY?: string;
}

const SUBJECT = 'Nueva consulta desde la web';
const MAX_BODY_BYTES = 20_000;
const LIMITS = { nombre: 100, email: 254, situacion: 100, mensaje: 5000 } as const;
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

type Fields = Record<'nombre' | 'email' | 'situacion' | 'mensaje' | 'token', string>;

class ClientError extends Error {}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/contacto' || url.pathname === '/api/contacto/') {
      if (request.method !== 'POST') {
        return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'POST' } });
      }
      return handleContact(request, env);
    }

    if (url.pathname.startsWith('/api/')) {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request: Request, env: Env): Promise<Response> {
  const wantsJson =
    (request.headers.get('Accept') ?? '').includes('application/json') ||
    (request.headers.get('Content-Type') ?? '').includes('application/json');

  const reply = (ok: boolean, status: number, error?: string): Response => {
    if (wantsJson) return Response.json(ok ? { ok } : { ok, error }, { status });
    const target = new URL(ok ? '/contacto/?enviado=1' : '/contacto/?error=1', request.url);
    return Response.redirect(target.toString(), 303);
  };

  let fields: Fields;
  try {
    fields = validate(await readFields(request));
  } catch (err) {
    if (err instanceof ClientError) return reply(false, 400, err.message);
    throw err;
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    console.error('contact: TURNSTILE_SECRET_KEY not configured');
    return reply(false, 500, 'server_misconfigured');
  }

  const human = await verifyTurnstile(fields.token, env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'));
  if (!human) return reply(false, 403, 'captcha_failed');

  try {
    await env.CONTACT_EMAIL.send({
      to: env.CONTACT_TO,
      from: { email: env.CONTACT_FROM, name: 'Orientación Olavarría (web)' },
      replyTo: { email: fields.email, name: fields.nombre },
      subject: SUBJECT,
      text: [
        `Nombre: ${fields.nombre}`,
        `Correo: ${fields.email}`,
        `Situación: ${fields.situacion || '-'}`,
        '',
        'Mensaje:',
        fields.mensaje || '(sin mensaje)',
        '',
        '--',
        `Enviado desde el formulario de ${new URL('/contacto/', request.url)}`,
        'Respondé este correo para contestarle directamente.',
      ].join('\n'),
    });
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    console.error('contact: send_email failed', code, err);
    return reply(false, 502, 'send_failed');
  }

  return reply(true, 200);
}

async function readFields(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > MAX_BODY_BYTES) throw new ClientError('payload_too_large');

  const type = request.headers.get('Content-Type') ?? '';
  try {
    if (type.includes('application/json')) {
      const data = await request.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ClientError('invalid_body');
      return data as Record<string, unknown>;
    }
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      return Object.fromEntries(await request.formData());
    }
  } catch (err) {
    if (err instanceof ClientError) throw err;
    throw new ClientError('invalid_body');
  }
  throw new ClientError('unsupported_media_type');
}

function validate(raw: Record<string, unknown>): Fields {
  const str = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string).trim() : '');
  // Single-line fields: collapse whitespace so nothing can smuggle line breaks into headers.
  const line = (key: string) => str(key).replace(/\s+/g, ' ');

  const fields: Fields = {
    nombre: line('nombre'),
    email: line('email'),
    situacion: line('situacion'),
    mensaje: str('mensaje').replace(/\r\n?/g, '\n'),
    token: str('cf-turnstile-response'),
  };

  if (!fields.nombre) throw new ClientError('nombre_required');
  if (!fields.email || !EMAIL_RE.test(fields.email)) throw new ClientError('email_invalid');
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (fields[key].length > LIMITS[key]) throw new ClientError(`${key}_too_long`);
  }
  if (!fields.token) throw new ClientError('captcha_missing');
  return fields;
}

async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<boolean> {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!data.success) console.warn('contact: turnstile rejected', data['error-codes']);
    return data.success === true;
  } catch (err) {
    console.error('contact: turnstile siteverify unreachable', err);
    return false;
  }
}
