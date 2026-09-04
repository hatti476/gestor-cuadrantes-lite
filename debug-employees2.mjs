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

// Try with waiting for navigation
const navPromise = p.waitForURL('**/employees', { timeout: 10000 }).catch(() => null);
await p.goto('http://localhost:3000/employees');
await navPromise;
await p.waitForLoadState('networkidle');
await p.waitForTimeout(3000);

console.log('URL:', p.url());
const title = await p.title();
console.log('Title:', title);
const h1 = await p.locator('h1').first().textContent().catch(() => 'no h1');
console.log('H1:', h1);

await b.close();
