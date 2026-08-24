# Playwright test structure — reference patterns

How to lay out a Playwright test suite, so the auto-healer knows *where* a locator
lives (spec vs. fixture vs. Page Object) and rewrites the right file.

Patterns below are adapted from the upstream examples directory:
<https://github.com/microsoft/playwright-test/tree/master/examples>

> ⚠️ That repo was archived in **June 2021** and predates `@playwright/test`. Its
> code targets the old **`folio`** test runner (`export const it = folio.it`,
> `folio.generateTests`). Use it for the *shape of the patterns*, not the API.
> The modern equivalents below use `@playwright/test` (`import { test, expect } from '@playwright/test'`).

The four canonical examples and what each demonstrates:

| Upstream example | Pattern it demonstrates | Modern equivalent |
|---|---|---|
| `basic-js` / `basic-ts` | minimal suite, one config + `tests/*.spec.ts` | `playwright.config.ts` + `tests/` |
| `login-once-per-worker` | shared auth captured once per worker via a worker-scoped fixture | `storageState` + project dependency, or worker fixture |
| `screenshot-on-failure` | auto-capture artifacts when a test fails | built-in `use: { screenshot: 'only-on-failure' }` |

---

## 1. Minimal layout (`basic-ts`)

```
my-app/
├── playwright.config.ts
├── package.json
└── tests/
    └── example.spec.ts
```

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

```ts
// tests/example.spec.ts
import { test, expect } from '@playwright/test';

test('places an order', async ({ page }) => {
  await page.goto('/');
  // Prefer role/text/test-id locators — they survive class & DOM-shape churn,
  // which is exactly what this skill heals toward.
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByText('Order confirmed')).toBeVisible();
});
```

**Healer note:** locators inline in the `.spec.ts` are rewritten in place.

---

## 2. Login once per worker (`login-once-per-worker`)

Upstream files: `tests/fixtures.ts` (worker-scoped login → captures cookies +
storage, injects into each test's context) and `tests/test.spec.ts`.

Modern `@playwright/test` equivalent — capture `storageState` once in a setup
project, reuse it everywhere:

```ts
// tests/auth.setup.ts
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
```

```ts
// playwright.config.ts (excerpt)
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
],
```

**Healer note:** if a broken locator lives in `auth.setup.ts` or a fixture file,
rewrite *that* file — not the spec that consumes the authenticated state.

---

## 3. Screenshot on failure (`screenshot-on-failure`)

Upstream did this with a fixture that snapped a screenshot in teardown when the
test failed. Modern Playwright makes it a one-line config — no fixture needed:

```ts
// playwright.config.ts (excerpt)
use: {
  screenshot: 'only-on-failure',
  trace: 'retain-on-failure',
  video: 'retain-on-failure',
},
```

**Healer note:** tests with `.screenshot()` / `toHaveScreenshot()` assertions are
the "visual layout" edge case — heal the locator, then warn that the snapshot
baseline may need a separate refresh.

---

## 4. Page Object Model (where locators commonly hide)

Not a separate upstream example, but the layout the healer must recognize: when
locators live in a POM class, rewrite the POM, not the spec.

```
tests/
├── pages/
│   └── checkout.page.ts   ← locators defined here
└── checkout.spec.ts       ← calls page-object methods
```

```ts
// tests/pages/checkout.page.ts
import { type Page, type Locator } from '@playwright/test';

export class CheckoutPage {
  readonly placeOrder: Locator;
  constructor(public readonly page: Page) {
    this.placeOrder = page.getByRole('button', { name: 'Place order' });
  }
  async submit() { await this.placeOrder.click(); }
}
```

**Healer note:** a drifted `this.placeOrder = page.locator('.btn-primary')` is
rewritten inside `checkout.page.ts`; the spec is left untouched.

---

## Locator stability ranking (why healing targets these)

When rewriting, prefer locators in this order — most stable first:

1. `getByRole(role, { name })` — semantic, survives class/DOM churn
2. `getByTestId('…')` — explicit contract (`data-testid`)
3. `getByLabel` / `getByPlaceholder` / `getByText` — user-visible anchors
4. CSS/XPath on classes or generated ids — **least stable; what breaks**

This ordering matches the scoring weights in [`scoring.md`](scoring.md).
