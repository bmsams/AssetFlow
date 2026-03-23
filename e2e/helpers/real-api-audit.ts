import { expect, type Page } from 'playwright/test';

export function captureStatuses(page: Page, matcher: (url: string) => boolean): number[] {
  const statuses: number[] = [];
  page.on('response', (response) => {
    if (matcher(response.url())) {
      statuses.push(response.status());
    }
  });
  return statuses;
}

export function assertNoServerErrors(statuses: number[], label: string): void {
  const badStatus = statuses.find((status) => status >= 500);
  expect(badStatus, `${label} returned 5xx status: ${String(badStatus ?? 'none')}`).toBeUndefined();
}

export function assertObserved(statuses: number[], label: string): void {
  expect(
    statuses.length,
    `${label} expected at least one matching API response during page load`
  ).toBeGreaterThan(0);
}

function toPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function createApiPathMatcher(...pathTokens: readonly string[]): (url: string) => boolean {
  return (url: string) => {
    const pathname = toPathname(url);
    const normalized = pathname.replace(/^\/v1(?=\/|$)/, '');
    return pathTokens.some(
      (token) => normalized.includes(token) || pathname.includes(token)
    );
  };
}
