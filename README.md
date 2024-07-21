# hogql

Execute PostHog [HogQL](https://posthog.com/docs/hogql) queries from your JavaScript code

## Installation

```bash
npm install --save hogql
```

## Usage

### From JavaScript code

```ts
import { hogql } from 'hogql';

(async () => {
  const { results } = await hogql<[string, string][]>('SELECT uuid, event FROM events LIMIT 500', {
    apiKey: process.env.POSTHOG_API_KEY,
    projectId: process.env.POSTHOG_PROJECT_ID,
  });

  for (const [uuid, event] of results) {
    console.log(`${uuid}: ${event}`);
  }
})();
```

### From the command line

Run the following command, specifying your query, and the query results will be printed as JSON to STDOUT:

```bash
npx hogql "SELECT * FROM events LIMIT 10"
```

As well as specifying the query, you must configure:

* a PostHog API key, using the `--posthog-api-key` option or the `POSTHOG_API_KEY` environment variable
* the PostHog project ID, using the `--posthog-project-id` option or the `POSTHOG_PROJECT_ID` environment variable

You may also configure:

* the PostHog base URL, if required, using the `--posthog-base-url` option or the `POSTHOG_BASE_URL` environment variable. Defaults to https://app.posthog.com.
* the format for the results. By default, an array of arrays will be logged to STDOUT as JSON, but you can set the `--return-objects` to return an array of key-value objects instead, using the column names returned by the PostHog API as keys