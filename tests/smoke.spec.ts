import { test, expect } from '@playwright/test';

test('homepage loads and renders root app', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Airbnb Lab/i);
  // Ensure React root mounts by checking Vite dev element gets replaced
  await expect(page.locator('#root')).toBeVisible();
});

test('backend and agent health checks are reachable', async ({ request }) => {
  // Lab2: Check traveler-service health endpoint (port 3001)
    const travelerResp = await request.get('http://127.0.0.1:3001/health');
  expect(travelerResp.ok()).toBeTruthy();
  const travelerJson = await travelerResp.json();
  expect(travelerJson).toMatchObject({ ok: true });

  // Lab2: Check agent-service health endpoint (port 8000)
  const agentResp = await request.get('http://127.0.0.1:8000/health');
  expect(agentResp.ok()).toBeTruthy();
  const agentJson = await agentResp.json();
  expect(agentJson).toMatchObject({ ok: true });
});


