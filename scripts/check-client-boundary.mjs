#!/usr/bin/env node
// Guards the one mistake `next build` cannot catch.
//
// A module with 'use client' has all of its exports turned into client
// references. Rendering an exported *component* from the server is fine.
// Calling an exported *function* from the server throws at request time:
//
//   Error: Attempted to call stateTone() from the server but stateTone is on
//   the client.
//
// Every page here is force-dynamic, so nothing renders during the build and the
// error only appears in production. This script finds it statically instead.
//
// Rule: a 'use client' module may only export components (PascalCase) or values
// in ALLOW. Anything lowercase is a function a server component might call.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const ALLOW = new Set(['toast']); // re-exported object, never called server-side

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const problems = [];

// Callback props that cross into a client component. A server component must
// pass a *server action reference* — `action.bind(null, id)` — not an inline
// arrow, or React throws "Event handlers cannot be passed to Client Component
// props" when it tries to serialise the tree.
const CALLBACK_PROPS = ['onSave', 'onConfirm', 'onRun', 'onValueChange', 'onCheckedChange', 'onClick'];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const isClient = /^\s*['"]use client['"]/m.test(src.slice(0, 200));

  if (!isClient) {
    for (const prop of CALLBACK_PROPS) {
      const re = new RegExp(`${prop}=\\{\\s*(?:\\(|async\\s|function\\b)`, 'g');
      for (const m of src.matchAll(re)) {
        const line = src.slice(0, m.index).split('\n').length;
        problems.push(
          `${relative(ROOT, file)}:${line} passes an inline function to '${prop}' from a server component.\n` +
            `  React cannot serialise it. Use a bound server action: action.bind(null, id).`
        );
      }
    }
    continue;
  }

  const names = [];
  for (const m of src.matchAll(/^export\s+(?:const|let|function|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.push(m[1]);
  }
  for (const m of src.matchAll(/^export\s+\{([^}]*)\}/gm)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop();
      if (name) names.push(name);
    }
  }

  for (const name of names) {
    if (ALLOW.has(name)) continue;
    if (/^[A-Z]/.test(name)) continue; // component
    problems.push(
      `${relative(ROOT, file)} exports '${name}' — lowercase export from a 'use client' module.\n` +
        `  If a server component calls it, production throws. Move it to lib/ui-helpers.ts.`
    );
  }
}

if (problems.length) {
  console.error('\nClient boundary check failed:\n');
  problems.forEach((p) => console.error('  ' + p + '\n'));
  process.exit(1);
}

console.log('Client boundary check passed.');
