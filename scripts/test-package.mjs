import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'spatial-id-package-'));
let tarball;

const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: temporaryDirectory,
  stdio: 'inherit',
  ...options,
});

try {
  const packResult = execFileSync(
    'npm',
    ['pack', '--json'],
    { cwd: root, encoding: 'utf8' },
  );
  const [{ filename }] = JSON.parse(packResult);
  tarball = join(root, filename);

  writeFileSync(
    join(temporaryDirectory, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  run('npm', ['install', tarball, '--ignore-scripts', '--no-audit', '--no-fund']);

  const esmCheck = [
    `import { Space } from '${packageJson.name}';`,
    "const space = new Space({ lng: 139.7671, lat: 35.6812, alt: 0 }, 25);",
    "if (space.zfxyStr !== '/25/0/29804453/13213001') throw new Error(space.zfxyStr);",
  ].join('\n');
  run('node', ['--input-type=module', '--eval', esmCheck]);

  const commonJsCheck = [
    `const { Space } = require('${packageJson.name}');`,
    "const space = new Space('/1/0/0/0');",
    "if (space.tilehash !== '1') throw new Error(space.tilehash);",
  ].join('\n');
  run('node', ['--input-type=commonjs', '--eval', commonJsCheck]);

  writeFileSync(
    join(temporaryDirectory, 'consumer.ts'),
    [
      `import { Space } from '${packageJson.name}';`,
      "const value: string = new Space('/1/0/0/0').zfxyStr;",
      'void value;',
    ].join('\n'),
  );
  execFileSync(
    join(root, 'node_modules', '.bin', 'tsc'),
    [
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--moduleResolution',
      'node',
      '--module',
      'commonjs',
      '--target',
      'es2019',
      join(temporaryDirectory, 'consumer.ts'),
    ],
    { cwd: temporaryDirectory, stdio: 'inherit' },
  );

  console.log(`Verified ${packageJson.name} from ${basename(tarball)} with ESM, CommonJS, and TypeScript.`);
} finally {
  if (tarball) rmSync(tarball, { force: true });
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
