import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const files = readdirSync('dist/assets').filter((name) => name.endsWith('.css'));
if (!files.length) throw new Error('No built stylesheets found. Run vite build first.');
for (const name of files) {
  const css = readFileSync(join('dist/assets', name), 'utf8');
  for (const [, condition] of css.matchAll(/@media\s*([^{}]+)\{/g)) {
    if (/[<>]/.test(condition)) {
      throw new Error(`${name}: Safari 15 cannot read media range syntax: ${condition}. Keep build.cssTarget set to safari15.`);
    }
  }
  if (/@(?:apply|screen)\b/.test(css)) throw new Error(`${name}: uncompiled Tailwind directives.`);
}
console.log(`Mobile CSS check passed: ${files.length} production stylesheets use Safari 15-compatible media queries.`);
