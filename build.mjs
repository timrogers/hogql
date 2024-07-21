import * as esbuild from 'esbuild'

import packageJson from './package.json' assert { type: 'json' }

const define = {
  'process.env.NPM_PACKAGE_VERSION': `'${packageJson.version}'`,
};

const esmLibrary = esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: false,
  outfile: 'dist/esm/index.js',
  platform: 'neutral',
  format: 'esm',
  define,
  tsconfig: 'tsconfig.json',
});

const commonjsLibrary = esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: false,
  outfile: 'dist/commonjs/index.js',
  platform: 'neutral',
  format: 'cjs',
  define,
  tsconfig: 'tsconfig-commonjs.json',
});

const esmBin = esbuild.build({
  entryPoints: ['src/bin/hogql.ts'],
  bundle: false,
  outfile: 'dist/esm/bin/hogql.js',
  platform: 'neutral',
  format: 'esm',
  define,
  tsconfig: 'tsconfig.json',
});

const commonjsBin = esbuild.build({
  entryPoints: ['src/bin/hogql.ts'],
  bundle: false,
  outfile: 'dist/commonjs/bin/hogql.js',
  platform: 'neutral',
  format: 'cjs',
  define,
  tsconfig: 'tsconfig-commonjs.json',
});

await Promise.all([esmLibrary, commonjsLibrary, esmBin, commonjsBin]);