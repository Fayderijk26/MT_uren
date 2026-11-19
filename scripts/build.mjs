import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const path of ['index.html', 'style.css', 'ui.js', 'assets', 'v2', 'excel/roster.js', 'excel/vendor']) {
  await cp(path, 'dist/' + path, { recursive: true });
}
