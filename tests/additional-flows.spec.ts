import { test, expect } from '@playwright/test';

const uniqueEmail = (prefix: string) => `${prefix}+${Date.now()}@example.com`;

test.describe('Favorites Flow', () => {
  test('traveler can add and remove favorites', async ({ page }) => {
    // Signup as traveler
    await page.goto('/signup');
    await page.selectOption('select', { value: 'TRAVELER' });
    await page.getByPlaceholder('John Smith').fill('Traveler Favorites');
    const email = uniqueEmail('favorites');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('Password123');
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Wait for successful signup
    await expect(page.getByRole('link', { name: /my bookings/i })).toBeVisible({ timeout: 15000 });

    // Search for properties
    await page.getByRole('link', { name: /^search$/i }).click();
    await page.getByPlaceholder('City or location').fill('San Jose');
    await page.getByRole('button', { name: /^search$/i }).click();
    
    // Wait for results
    await expect(page.getByRole('link', { name: /view details/i }).first()).toBeVisible({ timeout: 10000 });
    
    // Click first property
    await page.getByRole('link', { name: /view details/i }).first().click();
    await expect(page.getByRole('button', { name: /favourite/i })).toBeVisible();

    // Add to favorites
    await page.getByRole('button', { name: /favourite/i }).click();
    await expect(page.getByText(/added to favourites/i)).toBeVisible({ timeout: 5000 });

    // Go to favorites page
    await page.getByRole('link', { name: /favourites/i }).click();
    await expect(page.getByRole('button', { name: /unfavourite/i }).first()).toBeVisible({ timeout: 10000 });

    // Remove from favorites
    await page.getByRole('button', { name: /unfavourite/i }).first().click();
    await expect(page.getByText(/removed from favourites/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Checkout Flow', () => {
  test('traveler can complete mock checkout', async ({ page }) => {
    // Signup as traveler
    await page.goto('/signup');
    await page.selectOption('select', { value: 'TRAVELER' });
    await page.getByPlaceholder('John Smith').fill('Checkout Traveler');
    const email = uniqueEmail('checkout');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('Password123');
    await page.getByRole('button', { name: /create account/i }).click();
    
    await expect(page.getByRole('link', { name: /my bookings/i })).toBeVisible({ timeout: 15000 });

    // Search for properties
    await page.getByRole('link', { name: /^search$/i }).click();
    await page.getByPlaceholder('City or location').fill('San Jose');
    await page.getByRole('button', { name: /^search$/i }).click();
    
    await expect(page.getByRole('link', { name: /view details/i }).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /view details/i }).first().click();

    // Fill booking dates
    const today = new Date();
    const start = new Date(today.getTime() + 7 * 86400000);
    const end = new Date(today.getTime() + 10 * 86400000);
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    
    await page.locator('input[type="date"]').first().fill(toISO(start));
    await page.locator('input[type="date"]').nth(1).fill(toISO(end));

    // Click book button
    await page.getByRole('button', { name: /^book$/i }).click();
    
    // Should be on checkout page
    await expect(page.getByText(/confirm your stay/i)).toBeVisible({ timeout: 5000 });

    // Agree to terms
    await page.getByRole('checkbox').check();
    
    // Confirm booking
    await page.getByRole('button', { name: /confirm booking/i }).click();

    // Verify success
    await expect(page.getByText(/booking confirmed!/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Owner Approval Flow', () => {
  let ownerEmail: string;
  let travelerEmail: string;

  test('owner can approve traveler booking', async ({ page }) => {
    // === STEP 1: Create owner and property ===
    await page.goto('/signup');
    await page.selectOption('select', { value: 'OWNER' });
    await page.getByPlaceholder('John Smith').fill('Owner Approval');
    ownerEmail = uniqueEmail('owner-approval');
    await page.getByPlaceholder('you@example.com').fill(ownerEmail);
    await page.getByPlaceholder('••••••••').fill('Password123');
    await page.getByRole('button', { name: /create account/i }).click();
    
    await expect(page.getByRole('link', { name: /^dashboard$/i })).toBeVisible({ timeout: 15000 });

    // Create property
    await page.getByRole('link', { name: /host/i }).click();
    await page.getByPlaceholder('e.g., Cozy Downtown Loft with City Views').fill('Approval Test Property');
    await page.getByPlaceholder('Describe your property in detail...').fill('Property for testing approval');
    await page.getByPlaceholder('Street address').fill('123 Test St');
    await page.getByLabel(/^City/).fill('San Jose');
    await page.getByLabel('State/Province').fill('CA');
    await page.getByLabel(/^Country/).fill('USA');
    await page.getByLabel('Bedrooms').fill('2');
    await page.getByLabel('Bathrooms').fill('1');
    await page.getByLabel('Price per Night').fill('150');
    await page.getByLabel('Max Guests').fill('4');
    await page.getByPlaceholder('e.g., WiFi, Kitchen, Gym, Parking, Air Conditioning').fill('Wifi, Parking');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText(/Property created with id/i)).toBeVisible({ timeout: 10000 });

    // Logout owner
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page.getByRole('link', { name: /login/i })).toBeVisible();

    // === STEP 2: Create traveler booking ===
    await page.goto('/signup');
    await page.selectOption('select', { value: 'TRAVELER' });
    await page.getByPlaceholder('John Smith').fill('Approval Traveler');
    travelerEmail = uniqueEmail('traveler-approval');
    await page.getByPlaceholder('you@example.com').fill(travelerEmail);
    await page.getByPlaceholder('••••••••').fill('Password123');
    await page.getByRole('button', { name: /create account/i }).click();
    
    await expect(page.getByRole('link', { name: /my bookings/i })).toBeVisible({ timeout: 15000 });

    // Search and book the property
    await page.getByRole('link', { name: /^search$/i }).click();
    await page.getByPlaceholder('City or location').fill('San Jose');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page.getByRole('link', { name: /view details/i }).first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /view details/i }).first().click();

    // Book property
    const today = new Date();
    const start = new Date(today.getTime() + 14 * 86400000);
    const end = new Date(today.getTime() + 17 * 86400000);
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    
    await page.locator('input[type="date"]').first().fill(toISO(start));
    await page.locator('input[type="date"]').nth(1).fill(toISO(end));
    await page.getByRole('button', { name: /^book$/i }).click();
    
    // Complete checkout
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /confirm booking/i }).click();
    await expect(page.getByText(/booking confirmed!/i)).toBeVisible({ timeout: 10000 });

    // Logout traveler
    await page.getByRole('button', { name: /logout/i }).click();

    // === STEP 3: Owner approves booking ===
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(ownerEmail);
    await page.getByPlaceholder('••••••••').fill('Password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await expect(page.getByRole('link', { name: /^dashboard$/i })).toBeVisible({ timeout: 15000 });

    // Go to dashboard and verify pending booking
    await page.getByRole('link', { name: /^dashboard$/i }).click();
    await expect(page.getByText(/pending/i)).toBeVisible({ timeout: 10000 });

    // Find and accept the booking
    const acceptButton = page.getByRole('button', { name: /accept/i }).first();
    await expect(acceptButton).toBeVisible({ timeout: 5000 });
    await acceptButton.click();

    // Verify acceptance
    await expect(page.getByText(/accepted/i)).toBeVisible({ timeout: 5000 });
  });
});
