import fetchMock from 'fetch-mock';

import { hogql, HogQLError, RateLimitExceededError } from './index';

const DUMMY_API_KEY = 'secret';
const DUMMY_PROJECT_ID = '123';

fetchMock.config.overwriteRoutes = false;

afterEach(() => {
  // Some tests use fake timers and others use real timers, so we need to restore the original implementation
  // after each test to avoid affecting other tests.
  jest.useRealTimers();
});

describe('hogql', () => {
  it('executes a query and returns the results, hitting app.posthog.com by default', async () => {
    const fetch = fetchMock.sandbox().postOnce(
      `https://app.posthog.com/api/projects/${DUMMY_PROJECT_ID}/query`,
      {
        results: [
          [1, 'Alice'],
          [2, 'Bob'],
        ],
        columns: ['id', 'name'],
      },
      {
        body: {
          query: {
            kind: 'HogQLQuery',
            query: 'SELECT id, name FROM users',
          },
        },
      },
    );

    const results = await hogql('SELECT id, name FROM users', {
      apiKey: DUMMY_API_KEY,
      fetch,
      projectId: DUMMY_PROJECT_ID,
    });

    expect(results).toEqual({
      results: [
        [1, 'Alice'],
        [2, 'Bob'],
      ],
      columns: ['id', 'name'],
    });
  });

  it('executes a query and returns the results, hitting a custom base URL', async () => {
    const fetch = fetchMock.sandbox().postOnce(
      `https://eu.posthog.com/api/projects/${DUMMY_PROJECT_ID}/query`,
      {
        results: [
          [1, 'Alice'],
          [2, 'Bob'],
        ],
        columns: ['id', 'name'],
      },
      {
        body: {
          query: {
            kind: 'HogQLQuery',
            query: 'SELECT id, name FROM users',
          },
        },
      },
    );

    const results = await hogql('SELECT id, name FROM users', {
      apiKey: DUMMY_API_KEY,
      baseUrl: 'https://eu.posthog.com',
      fetch,
      projectId: DUMMY_PROJECT_ID,
    });

    expect(results).toEqual({
      results: [
        [1, 'Alice'],
        [2, 'Bob'],
      ],
      columns: ['id', 'name'],
    });
  });

  it('throws a RateLimitExceededError if the request fails due to rate limiting', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01'));

    const fetch = fetchMock.sandbox().postOnce(
      `https://app.posthog.com/api/projects/${DUMMY_PROJECT_ID}/query`,
      {
        status: 429,
        body: {
          type: 'throttled_error',
          code: 'throttled',
          detail: 'Expected available in 123 seconds.',
          attr: null,
        },
      },
      {
        body: {
          query: {
            kind: 'HogQLQuery',
            query: 'SELECT id, name FROM users',
          },
        },
      },
    );

    try {
      await hogql('SELECT id, name FROM users', {
        apiKey: DUMMY_API_KEY,
        fetch,
        projectId: DUMMY_PROJECT_ID,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitExceededError);
      expect(error.message).toBe('Expected available in 123 seconds.');

      expect(error.detail).toBe('Expected available in 123 seconds.');
      expect(error.type).toBe('throttled_error');
      expect(error.code).toBe('throttled');
      expect(error.rateLimitResetsAt).toEqual(new Date('2024-01-01T00:02:03Z'));
    }
  });

  it('throws a HogQLError if the query execution fails for any other reason', async () => {
    const fetch = fetchMock.sandbox().postOnce(
      `https://app.posthog.com/api/projects/${DUMMY_PROJECT_ID}/query`,
      {
        status: 500,
        body: {
          type: 'server_error',
          code: 'error',
          detail: 'A server error occurred.',
          attr: null,
        },
      },
      {
        body: {
          query: {
            kind: 'HogQLQuery',
            query: 'SELECT id, name FROM users',
          },
        },
      },
    );

    try {
      await hogql('SELECT id, name FROM users', {
        apiKey: DUMMY_API_KEY,
        fetch,
        projectId: DUMMY_PROJECT_ID,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(HogQLError);
      expect(error.message).toBe('A server error occurred.');

      expect(error.detail).toBe('A server error occurred.');
      expect(error.type).toBe('server_error');
      expect(error.code).toBe('error');
    }
  });

  it('retries rate limit failures if retryOnRateLimit is enabled', async () => {
    const fetch = fetchMock
      .sandbox()
      .postOnce(
        `https://app.posthog.com/api/projects/${DUMMY_PROJECT_ID}/query`,
        {
          status: 429,
          body: {
            type: 'throttled_error',
            code: 'throttled',
            detail: 'Expected available in 2 seconds.',
            attr: null,
          },
        },
        {
          body: {
            query: {
              kind: 'HogQLQuery',
              query: 'SELECT id, name FROM users',
            },
          },
        },
      )
      .postOnce(
        `https://app.posthog.com/api/projects/${DUMMY_PROJECT_ID}/query`,
        {
          results: [
            [1, 'Alice'],
            [2, 'Bob'],
          ],
          columns: ['id', 'name'],
        },
        {
          body: {
            query: {
              kind: 'HogQLQuery',
              query: 'SELECT id, name FROM users',
            },
          },
        },
      );

    const results = await hogql('SELECT id, name FROM users', {
      apiKey: DUMMY_API_KEY,
      fetch,
      projectId: DUMMY_PROJECT_ID,
      retryOnRateLimit: true,
    });

    expect(results).toEqual({
      results: [
        [1, 'Alice'],
        [2, 'Bob'],
      ],
      columns: ['id', 'name'],
    });
  });
});
