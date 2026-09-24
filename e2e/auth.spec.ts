import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@flagraft.local'
const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? 'flagraft-admin'

/** Signing in is the preamble to most of these tests; keep the selectors in one place. */
async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel(/^email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/^password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/flags/)
}

// ---------------------------------------------------------------------------
// 2. Unauthenticated Redirect
// ---------------------------------------------------------------------------
test.describe('Unauthenticated redirect', () => {
  test('visiting / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('visiting /flags redirects to /login', async ({ page }) => {
    await page.goto('/flags')
    await expect(page).toHaveURL(/\/login/)
  })

  test('visiting /users redirects to /login', async ({ page }) => {
    await page.goto('/users')
    await expect(page).toHaveURL(/\/login/)
  })

  test('visiting /settings redirects to /login', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ---------------------------------------------------------------------------
// 3. Login Screen UI
// ---------------------------------------------------------------------------
test.describe('Login screen UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('shows two-column layout with brand panel and form', async ({ page }) => {
    await expect(page.locator('.auth-brand')).toBeVisible()
    await expect(page.locator('.auth-main')).toBeVisible()
  })

  test('email field has a label and type email', async ({ page }) => {
    const input = page.getByLabel(/^email/i)
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('type', 'email')
  })

  test('password field has type password by default', async ({ page }) => {
    const input = page.getByLabel(/^password/i)
    await expect(input).toHaveAttribute('type', 'password')
  })

  test('show password toggle switches type to text and back', async ({ page }) => {
    const input = page.getByLabel(/^password/i)
    await page.getByRole('button', { name: /show password/i }).click()
    await expect(input).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: /hide password/i }).click()
    await expect(input).toHaveAttribute('type', 'password')
  })
})

// ---------------------------------------------------------------------------
// 4. Login — Wrong Credentials
// ---------------------------------------------------------------------------
test.describe('Login with wrong credentials', () => {
  test('shows error alert and no cookie is set', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/^email/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/^password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'flagraft_session')).toBeUndefined()
  })

  test('submit button is disabled during request', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/^email/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/^password/i).fill('wrongpassword')
    const btn = page.getByRole('button', { name: /sign in/i })
    await btn.click()
    // Button should briefly show "Signing in..." and be disabled
    await expect(page.getByRole('button', { name: /signing in/i })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// 5. Login — Correct Credentials
// ---------------------------------------------------------------------------
test.describe('Login with correct credentials', () => {
  test('redirects to /flags after successful login', async ({ page }) => {
    await signIn(page)
  })

  test('sets an HttpOnly flagraft_session cookie', async ({ page }) => {
    await signIn(page)

    const cookies = await page.context().cookies()
    const session = cookies.find((c) => c.name === 'flagraft_session')
    expect(session).toBeDefined()
    expect(session?.httpOnly).toBe(true)
    expect(session?.sameSite).toBe('Strict')
    expect(session?.path).toBe('/')
  })

  test('session cookie is NOT accessible via document.cookie', async ({ page }) => {
    await signIn(page)

    const cookieStr = await page.evaluate(() => document.cookie)
    expect(cookieStr).not.toContain('flagraft_session')
  })
})

// ---------------------------------------------------------------------------
// 6. Authenticated State
// ---------------------------------------------------------------------------
test.describe('Authenticated state', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('SideNav footer shows logged-in user name and role', async ({ page }) => {
    await expect(page.locator('.sidenav-user-name')).toContainText('Admin')
    await expect(page.locator('.sidenav-user-role')).toContainText('owner')
  })

  test('refreshing the page keeps you logged in', async ({ page }) => {
    await page.reload()
    await expect(page).toHaveURL(/\/flags/)
    await expect(page.locator('.sidenav-user-name')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 7. Protected Routes
// ---------------------------------------------------------------------------
test.describe('Protected routes work when logged in', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('/flags loads the flags screen', async ({ page }) => {
    await page.goto('/flags')
    await expect(page.getByRole('heading', { name: /feature flags/i })).toBeVisible()
  })

  test('/users loads the users screen', async ({ page }) => {
    await page.goto('/users')
    await expect(page).toHaveURL(/\/users/)
  })

  test('/settings loads the settings screen', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /project settings/i })).toBeVisible()
  })

  test('navigating between routes does not log you out', async ({ page }) => {
    await page.goto('/users')
    await page.goto('/settings')
    await page.goto('/flags')
    await expect(page).toHaveURL(/\/flags/)
    await expect(page.locator('.sidenav-user-name')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 11. Sign Out
// ---------------------------------------------------------------------------
test.describe('Sign out', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('clicking sign out redirects to /login and clears the session cookie', async ({ page }) => {
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/)
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'flagraft_session')).toBeUndefined()
  })

  test('pressing back after logout and visiting /flags redirects to /login', async ({ page }) => {
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/flags')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ---------------------------------------------------------------------------
// 12. Already Logged In Redirect
// ---------------------------------------------------------------------------
test.describe('Already logged-in redirect', () => {
  test('visiting /login while authenticated redirects to /flags', async ({ page }) => {
    await signIn(page)

    await page.goto('/login')
    await expect(page).toHaveURL(/\/flags/)
  })
})
