// Pure request handler; adapters hold credentials. No customer account conversion.
export type StaffDependencies = {
  origin: string;
  verifyToken: (token: string) => Promise<string | null>;
  authorize: (actor: string) => Promise<void>;
  create: (actor: string, name: string, email: string, nonce: string, password: string) => Promise<string>;
  finish: (actor: string, user: string, nonce: string) => Promise<void>;
  activate: (user: string) => Promise<void>;
};

export class ProvisionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function createStaffHandler(deps: StaffDependencies) {
  return async (request: Request): Promise<Response> => {
    const headers = { 'Access-Control-Allow-Origin': deps.origin, 'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
    if (request.headers.get('origin') && request.headers.get('origin') !== deps.origin) return reply(403, { error: 'Origin not allowed.' });
    if (request.method === 'OPTIONS') return reply(200, {});
    if (request.method !== 'POST') return reply(405, { error: 'POST required.' });
    let stage: 'authorization' | 'creation' | 'finalization' | 'activation' = 'authorization';
    try {
      const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if (!token) return reply(401, { error: 'Please sign in again.' });
      const actor = await deps.verifyToken(token);
      if (!actor) return reply(401, { error: 'Please sign in again.' });
      // Required before any Auth creation and repeated atomically at assignment.
      await deps.authorize(actor);
      if (Number(request.headers.get('content-length') ?? 0) > 4096) return reply(413, { error: 'Request too large.' });
      const text = await request.text();
      if (text.length > 4096) return reply(413, { error: 'Request too large.' });
      let input;
      try { input = JSON.parse(text); } catch { return reply(400, { error: 'Invalid request.' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).some(key => !['fullName', 'email', 'password'].includes(key))) return reply(400, { error: 'Only full name, email and password are accepted.' });
      const name = typeof input.fullName === 'string' ? input.fullName.trim() : '';
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (!name || name.length > 150 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'Enter a valid full name and email.' });
      const password = typeof input.password === 'string' ? input.password : '';
      if (password.length < 12 || new TextEncoder().encode(password).length > 72) return reply(400, { error: 'Password must have at least 12 characters and no more than 72 UTF-8 bytes.' });
      const nonce = crypto.randomUUID();
      stage = 'creation';
      const user = await deps.create(actor, name, email, nonce, password);
      stage = 'finalization';
      await deps.finish(actor, user, nonce);
      stage = 'activation';
      await deps.activate(user);
      return reply(201, { ok: true, id: user, role: 'staff' });
    } catch (error) {
      // Never return credentials, Auth objects, links or raw infrastructure errors.
      if (stage === 'finalization') return reply(502, { code: 'FINALIZATION_UNCONFIRMED', error: 'A new account was created banned, but staff finalization could not be confirmed. Activation was not attempted. Contact the project owner; do not create it again.', accountCreated: true });
      if (stage === 'activation') return reply(502, { code: 'ACTIVATION_UNCONFIRMED', error: 'The staff profile was finalized, but activation could not be confirmed. The account may still be banned or activation may have succeeded. Contact the project owner to check; do not retry creation or activation automatically.', accountCreated: true });
      if (error instanceof ProvisionError) return reply(error.status, { error: error.message });
      if (stage === 'creation') return reply(503, { code: 'CREATION_UNCONFIRMED', error: 'Account creation could not be confirmed. A new banned account may exist. Contact the project owner to check before retrying.', accountCreated: null });
      return reply(503, { error: 'Staff provisioning is unavailable. Contact the project administrator.' });
    }
  };
}
