// Run with Node 24+, Python GI/Rsvg and Cairo: node scripts/generate-brand-assets.mjs
// Vector artwork stays editable; no image tooling is needed by the app at runtime.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Brand, brandMarkSvg } from '../src/constants/branding.ts';

const output = fileURLToPath(new URL('../assets/branding/', import.meta.url));
mkdirSync(output, { recursive: true });
writeFileSync(`${output}mark.svg`, brandMarkSvg);

function canvas(mark, scale, background = '') {
  const offset = (1024 - 512 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}<g transform="translate(${offset} ${offset}) scale(${scale})">${mark}</g></svg>`;
}

function png(name, svg, size = 1024, opaque = false) {
  writeFileSync(`${output}${name}.svg`, svg);
  const render = `import sys, gi, cairo
gi.require_version('Rsvg', '2.0')
from gi.repository import Rsvg
source, destination, size, opaque = sys.argv[1:]
size = int(size)
surface = cairo.ImageSurface(cairo.FORMAT_RGB24 if opaque == 'true' else cairo.FORMAT_ARGB32, size, size)
context = cairo.Context(surface)
handle = Rsvg.Handle.new_from_file(source)
viewport = Rsvg.Rectangle()
viewport.x = viewport.y = 0
viewport.width = viewport.height = size
handle.render_document(context, viewport)
surface.write_to_png(destination)
`;
  const result = spawnSync('/usr/bin/python3', ['-c', render, `${output}${name}.svg`, `${output}${name}.png`, String(size), String(opaque)], { encoding: 'utf8', timeout: 15000 });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr);
}

png('icon', canvas(brandMarkSvg, 1.8, Brand.background), 1024, true);
// Keep the entire mark inside Android's central 66/108 safe circle.
png('adaptive-foreground', canvas(brandMarkSvg, 1.45));
const monochrome = brandMarkSvg.replace(/url\(#warm\)|#ED1C20|#F38820/g, '#FFFFFF');
png('adaptive-monochrome', canvas(monochrome, 1.45));
png('splash-mark', brandMarkSvg);
png('favicon', canvas(brandMarkSvg, 1.8, Brand.background), 64, true);
console.log('Generated Latch launcher, adaptive, monochrome, splash and favicon PNGs.');
