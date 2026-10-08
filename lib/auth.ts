// Simple passcode gate (no accounts). Cookies hold a hash of the passcode, never the passcode.
export const APP_COOKIE = 'abi_app';
export const PARENT_COOKIE = 'abi_parent';

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function appToken(): Promise<string | null> {
  const p = process.env.APP_PASSCODE;
  return p ? sha256(`abi-school:app:${p}`) : null;
}

export async function parentToken(): Promise<string | null> {
  const p = process.env.PARENT_PIN;
  return p ? sha256(`abi-school:parent:${p}`) : null;
}

export async function checkPasscode(kind: 'app' | 'parent', value: string): Promise<string | null> {
  const expected = kind === 'app' ? process.env.APP_PASSCODE : process.env.PARENT_PIN;
  if (!expected || value !== expected) return null;
  return kind === 'app' ? appToken() : parentToken();
}
