import { test, expect } from '@playwright/test';

const uniqueEmail = (prefix: string) => `${prefix}+${Date.now()}@example.com`;

test.describe('Full E2E: owner posts property, traveler books and favorites', () => {
  test('signup owner → post property → logout → signup traveler → search → view → favourite → book → verify', async ({ page }) => {
    // Owner signup
    await page.goto('/signup');
    await page.selectOption('select', { value: 'OWNER' });
    await page.getByPlaceholder('John Smith').fill('Owner User');
    const ownerEmail = uniqueEmail('owner');
    await page.getByPlaceholder('you@example.com').fill(ownerEmail);
    await page.getByPlaceholder('••••••••').fill('Password123');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByRole('link', { name: /^dashboard$/i })).toBeVisible({ timeout: 15000 });

    // Post property
    await page.getByRole('link', { name: /host/i }).click();
    await page.getByPlaceholder('e.g., Cozy Downtown Loft with City Views').fill('Cozy Test Apartment');
    await page.getByPlaceholder('Describe your property in detail...').fill('A cozy place for testing.');
    await page.getByPlaceholder('Street address').fill('1 Test Way');
    await page.getByLabel(/^City/).fill('San Jose');
    await page.getByLabel('State/Province').fill('CA');
    await page.getByLabel(/^Country/).fill('USA');
    // Use label-based selection for number inputs
    await page.getByLabel('Bedrooms').fill('2');
    await page.getByLabel('Bathrooms').fill('1');
    await page.getByLabel('Price per Night').fill('150');
    await page.getByLabel('Max Guests').fill('3');
    await page.getByPlaceholder('e.g., WiFi, Kitchen, Gym, Parking, Air Conditioning').fill('Wifi, Parking');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText(/Property created with id/i)).toBeVisible();

    // Logout owner
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page.getByRole('link', { name: /login/i })).toBeVisible();

    // Traveler signup
    await page.goto('/signup');
    await page.selectOption('select', { value: 'TRAVELER' });
    await page.getByPlaceholder('John Smith').fill('Traveler User');
    const travelerEmail = uniqueEmail('traveler');
    await page.getByPlaceholder('you@example.com').fill(travelerEmail);
    await page.getByPlaceholder('••••••••').fill('Password123');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByRole('link', { name: /my bookings/i })).toBeVisible({ timeout: 15000 });

    // Profile update
    await page.getByRole('link', { name: /traveler user/i }).click();
    await expect(page.getByRole('heading', { name: /my profile/i })).toBeVisible();
    await page.getByPlaceholder('Phone').fill('555-0101');
    await page.getByPlaceholder('Gender').fill('Other');
    await page.getByPlaceholder('City').fill('San Jose');
    // Set Country to USA (this will switch State input to a select)
    await page.selectOption('select', { value: 'USA' });
    // Select State = CA if the state select is present; ignore if not
    const stateSelect = page.locator('select').first();
    try { await stateSelect.selectOption('CA'); } catch {}
    // Save
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText('Saved')).toBeVisible();

    // Search and open property
    await page.getByRole('link', { name: /^search$/i }).click();
    await page.getByPlaceholder('City or location').fill('San Jose');
    await page.getByRole('button', { name: /^search$/i }).click();
    const viewLink = page.getByRole('link', { name: /view details/i }).first();
    await expect(viewLink).toBeVisible();
    await viewLink.click();
    await expect(page.getByRole('button', { name: /book/i })).toBeVisible();

    // Favourite
    await page.getByRole('button', { name: /favourite/i }).click();
    await expect(page.getByText(/added to favourites/i)).toBeVisible();

    // Book
    // Ensure future dates
    const today = new Date();
    const start = new Date(today.getTime() + 7 * 86400000);
    const end = new Date(today.getTime() + 10 * 86400000);
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    await page.locator('input[type="date"]').first().fill(toISO(start));
    await page.locator('input[type="date"]').nth(1).fill(toISO(end));
    await page.getByRole('button', { name: /^book$/i }).click();
    await expect(page.getByText(/Booking created\./i)).toBeVisible();

    // Verify favourites list
    await page.getByRole('link', { name: /favourites/i }).click();
    await expect(page.getByRole('button', { name: /unfavourite/i })).toBeVisible({ timeout: 15000 });

    // Verify bookings list
    await page.getByRole('link', { name: /my bookings/i }).click();
    await expect(page.getByText(/PENDING|ACCEPTED|CANCELLED/)).toBeVisible({ timeout: 15000 });
  });
});


