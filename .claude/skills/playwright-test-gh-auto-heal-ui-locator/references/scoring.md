# Candidate Scoring Matrix

The `findCandidates` function in [`scripts/packages/ts/src/locator-resolver.ts`](../scripts/packages/ts/src/locator-resolver.ts) walks every visible element in the new DOM and scores each one against the fingerprint of the old (broken) element. Higher score = more likely to be the same logical element under a new shell of class names / tag swaps.

## Weights

| Signal              | Weight | Rationale                                                                 |
| ------------------- | ------ | ------------------------------------------------------------------------- |
| `data-testid` match | 100    | Explicit test contract — never coincidence.                               |
| Text content match  |  60    | Visible text is high-signal but localizable; weight discounted on partial. |
| `role` + name       |  50    | Accessibility identity; survives style refactors.                         |
| Ancestor path       |  30    | Up to 3 levels; suffix-match means insertion of wrapper divs is tolerated. |
| `aria-label`        |  25    | Stable but lighter than role+name (no role context).                       |
| `id`                |  20    | Often unique but devs do change ids during refactors.                     |
| Tag match           |  10    | Confirms the structural type (`button` vs `a` vs `div`).                  |
| Class overlap       |  10    | Lowest — the failure mode is class renames; soft signal only.             |

Maximum theoretical score: **305**. Confidence = score / max-score.

## Threshold

Default threshold is `0.75`. Empirically:

- `> 0.90` — near-certain match (testid + text + role typically present).
- `0.75 – 0.90` — strong match; auto-rewrite is safe.
- `0.50 – 0.75` — plausible but ambiguous; surface to user.
- `< 0.50` — element likely removed or substantially redesigned.

When two candidates tie at the top score, the resolver reports `AMBIGUOUS` rather than guessing.

## Tuning

Tune by adjusting the `WEIGHTS` constant. Real-world tuning guidance:

- If your app has heavy `data-testid` usage, push that weight even higher (200) so a missing-testid degradation never resolves to a wrong sibling.
- If your app relies on `getByRole`, raise `roleAndName` over `text` so localized strings don't dominate.
- For internationalized apps, halve `text` weight — translated copy will not match across locales.
- For dynamically-generated content, drop `id` weight: framework-emitted ids (`mui-12345`) are not stable across renders.

## Locator derivation priority

Once a candidate is chosen, [`deriveLocator`](../scripts/packages/ts/src/locator-resolver.ts) picks the Playwright API call to emit. Priority order:

1. `getByTestId(value)` — when `data-testid` present
2. `getByRole(role, { name })` — when role (explicit or implicit) + accessible name
3. `getByLabel(text)` — for form inputs with an associated `<label for=…>`
4. `getByPlaceholder(text)` — fallback for form inputs
5. `getByText(value, { exact: true })` — for short static text
6. `locator('#id')` — stable id
7. `locator('[data-test=…]')` / `data-cy` / `data-qa`
8. `locator(cssPath)` — last resort

Class selectors (`.btn-primary`) are *never* emitted, since they are exactly the failure mode the skill exists to escape.
