# hogql

Execute PostHog [HogQL](https://posthog.com/docs/hogql) queries from your JavaScript code

## Installation

```bash
npm install --save hogql
```

## Example

```ts
import { hogql } from 'hogql';

(async () => {
  const { results } = await hogql<[string, string]>('SELECT uuid, event FROM events LIMIT 500', {
    apiKey: process.env.POSTHOG_API_KEY,
    projectId: process.env.POSTHOG_PROJECT_ID,
  });

  for (const [uuid, event] of results) {
    console.log(`${uuid}: ${event}`);
  }
})();
```
