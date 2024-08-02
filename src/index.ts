/**
 * The options for executing a HogQL query
 */
export interface HogQLQueryOptions {
  /**
   * The PostHog API key for authentication
   */
  apiKey: string;

  /**
   * The base URL for the PostHog API. Defaults to https://us.posthog.com. Can be overridden to point to EU Cloud (https://eu.posthog.com) or a self-hosted instance.
   */
  baseUrl?: string;

  /**
   * The fetch implementation to use for making HTTP requests. Defaults to the global `fetch` function. Can be overridden to use a different fetch implementation, such as `node-fetch` in Node.js.
   */
  fetch?: typeof fetch;

  /**
   * The ID of the PostHog project
   */
  projectId: string;

  /**
   * Whether to automatically retry the request if it is rate limited. Defaults to `false`. If set to `true`, the request will be retried after the rate limit resets. If set to `false`, a `RateLimitExceededError` will be thrown if the request is rate limited.
   */
  retryOnRateLimit?: boolean;
}

/**
 * The result of a HogQL query
 *
 * @template T - The type of the query result. PostHog returns an array of arrays, where each inner array represents a row of the result set.
 */
export interface HogQLQueryResult<T extends HogQLScalar[][]> {
  results: T;
  columns: string[];
}

/**
 * A column value in a HogQL query result set
 */
export type HogQLScalar = string | number | null;

interface HogQLQuerySuccessResponse<T> {
  columns: string[];
  results: T;
}

interface HogQLQueryErrorResponse {
  type: string;
  code: string;
  detail: string;
  attr: unknown;
}

const DEFAULT_BASE_URL = 'https://app.posthog.com';

export class HogQLError extends Error {
  code: string;
  detail: string;
  type: string;

  constructor({ code, detail, type }: { code: string; detail: string; type: string }) {
    super(detail);
    this.name = 'HogQLError';
    this.code = code;
    this.detail = detail;
    this.type = type;
  }
}

export class RateLimitExceededError extends HogQLError {
  rateLimitResetsAt: Date;

  constructor({
    code,
    detail,
    rateLimitResetsAt,
    type,
  }: {
    code: string;
    detail: string;
    rateLimitResetsAt: Date;
    type: string;
  }) {
    super({ code, detail, type });
    this.name = 'RateLimitExceededError';
    this.rateLimitResetsAt = rateLimitResetsAt;
  }
}

/**
 * Parses the number of seconds to wait from a throttling error message.
 * @param {string} detail - The error message containing the throttling details.
 * @returns {number | null} - The number of seconds until the rate limit results, or `null` if it couldn't be determined
 */
const parseDelayFromThrottledErrorDetail = (detail: string): number => {
  const match = detail.match(/Expected available in (\d+) seconds\./);

  if (match) {
    return parseInt(match[1], 10);
  }
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a HogQL query.
 *
 * @template T - The type of the query result. PostHog returns an array of arrays, where each inner array represents a row of the result set.
 * @param {string} query - The HogQL query to execute
 * @param {HogQLQueryOptions} options - The options for executing the query
 * @returns {Promise<HogQLQueryResult<T>>} - A promise that resolves to the query result
 * @throws {RateLimitExceededError} - If the request fails due to rate limiting
 * @throws {HogQLError} - If the query execution fails for any other reason
 */
export const hogql = async <T extends HogQLScalar[][] = HogQLScalar[][]>(
  query: string,
  {
    apiKey,
    baseUrl: providedBaseUrl,
    fetch: providedFetch,
    projectId,
    retryOnRateLimit,
  }: HogQLQueryOptions,
): Promise<HogQLQueryResult<T>> => {
  const baseUrl = providedBaseUrl || DEFAULT_BASE_URL;
  const url = `${baseUrl}/api/projects/${projectId}/query`;

  const fetchFn = providedFetch || fetch;

  const response = await fetchFn(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query,
      },
    }),
  });

  if (response.ok) {
    const { columns, results } = (await response.json()) as HogQLQuerySuccessResponse<T>;

    return { columns, results };
  } else {
    const { code, detail, type } = (await response.json()) as HogQLQueryErrorResponse;

    if (type === 'throttled_error') {
      const rateLimitResetsInSeconds = parseDelayFromThrottledErrorDetail(detail);

      if (retryOnRateLimit) {
        await sleep(rateLimitResetsInSeconds * 1_000);
        return hogql(query, {
          apiKey,
          baseUrl,
          fetch: providedFetch,
          projectId,
          retryOnRateLimit,
        });
      } else {
        const rateLimitResetsAt = new Date(Date.now() + rateLimitResetsInSeconds * 1000);
        throw new RateLimitExceededError({ code, detail, rateLimitResetsAt, type });
      }
    } else {
      throw new HogQLError({ code, detail, type });
    }
  }
};
