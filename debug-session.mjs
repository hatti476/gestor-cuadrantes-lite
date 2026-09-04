import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:3000/login');
await p.waitForFunction(() => {
  const f = document.querySelector('form');
  const k = f && Object.keys(f).find(x => x.startsWith('__reactProps'));
  return !!k && typeof f[k].onSubmit === 'function';
});
await p.getByLabel('Email').fill('admin@cuadrantes.local');
await p.getByLabel('Contraseña').fill('Admin1234!');
await p.getByRole('button', { name: 'Entrar' }).click();
await p.waitForURL(u => u.pathname === '/', { waitUntil: 'commit' });

// Check session via API
const session = await p.request.get('http://localhost:3000/api/auth/session');
console.log('Session:', await session.json());

// Check if isAdmin would return true
const role = await p.evaluate(() => {
  // Check what's in localStorage or cookies
  return document.cookie;
});
console.log('Cookies:', role);

await b.close();
