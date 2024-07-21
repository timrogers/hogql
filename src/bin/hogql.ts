#!/usr/bin/env node

import { program } from 'commander';
import { hogql, HogQLError, HogQLScalar } from '../index.js';

const VERSION = process.env.NPM_PACKAGE_VERSION || '0.0.0-development';

interface Arguments {
  apiKey?: string;
  projectId?: string;
  baseUrl?: string;
  returnObjects: boolean;
}

program
  .version(VERSION)
  .description('Execute a HogQL query, returning the results as JSON.')
  .option(
    '--api-key <apiKey>',
    'A PostHog API key. Required. This can also be set using the POSTHOG_API_KEY environment variable.',
  )
  .option(
    '--project-id <projectId>',
    'The ID of the PostHog project. Required. This can also be set using the POSTHOG_PROJECT_ID environment variable.',
  )
  .option(
    '--base-url <baseUrl>',
    'The base URL for the PostHog API. Defaults to https://app.posthog.com. This can also be set using the POSTHOG_BASE_URL environment variable.',
  )
  .option(
    '--return-objects',
    'Return objects instead of arrays in the result set. This will return an array of objects, where each object represents a row of the result set. By default, an array of arrays is returned.',
    false,
  )
  .argument('<query>', 'The HogQL query to execute');

program.parse(process.argv);
const opts = program.opts() as Arguments;
const [query] = program.processedArgs;

const apiKey = opts.apiKey || process.env.POSTHOG_API_KEY;

if (!apiKey) {
  console.error(
    'A PostHog API key must be provided using the --api-key argument or POSTHOG_API_KEY environment variable',
  );
  process.exit(1);
}

const projectId = opts.projectId || process.env.POSTHOG_PROJECT_ID;

if (!projectId) {
  console.error(
    'A PostHog project ID must be provided using the --project-id argument or POSTHOG_PROJECT_ID environment variable',
  );
  process.exit(1);
}

(async () => {
  try {
    const { columns, results } = await hogql(query, {
      apiKey,
      baseUrl: opts.baseUrl,
      projectId,
    });

    if (opts.returnObjects) {
      const objects = results.map((row) =>
        row.reduce(
          (acc, value, index) => {
            acc[columns[index]] = value;
            return acc;
          },
          {} as Record<string, HogQLScalar>,
        ),
      );

      console.log(JSON.stringify(objects, null, 2));
    } else {
      console.log(JSON.stringify(results, null, 2));
    }
  } catch (e) {
    if (e instanceof HogQLError) {
      console.error(`Error executing query: ${e.detail}`);
      process.exit(1);
    } else {
      console.error('An unexpected error occurred', e);
      process.exit(1);
    }
  }
})();
