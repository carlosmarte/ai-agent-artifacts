export type FailureCategory =
  | "LOCATOR_DRIFT"
  | "ASSERTION_DRIFT"
  | "INFRA_ERROR"
  | "UNKNOWN";

export interface FailingLocator {
  testFile: string;
  line: number;
  column?: number;
  /** Raw locator string as it appeared in source, e.g. ".btn-primary" */
  rawSelector: string;
  /** Playwright API used: "locator" | "getByRole" | "getByTestId" | "getByText" | ... */
  api: string;
  /** Original error message from Playwright. */
  message: string;
}

export interface ElementFingerprint {
  tag: string;
  text?: string;
  attrs: Record<string, string>;
  /** Ancestor chain top-down, up to 3 levels. Each entry: "tag[role=…]" */
  ancestors: string[];
  /** Sibling index inside its parent (0-based). */
  siblingIndex: number;
}

export interface Candidate {
  fingerprint: ElementFingerprint;
  /** Suggested locator call, e.g. `getByRole('button', { name: 'Place order' })` */
  locator: string;
  score: number;
  /** Normalized score in [0, 1] */
  confidence: number;
}

export interface HealResult {
  status: "HEALED" | "HEAL_FAILED" | "ELEMENT_REMOVED" | "AMBIGUOUS";
  testFile: string;
  failing: FailingLocator;
  newLocator?: string;
  confidence?: number;
  candidates: Candidate[];
  diff?: string;
}
