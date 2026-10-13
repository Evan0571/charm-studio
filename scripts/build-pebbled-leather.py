"""Generate LOOP's seamless, neutral pebbled-leather PBR maps.

Requires numpy and Pillow. No photographed light/shadow is baked into the color
map; color stays tintable. The normal map uses the OpenGL (+Y) convention.
Run from any directory; output is deterministic and contains no external assets.
"""
from pathlib import Path
import numpy as np
from PIL import Image

SIZE, CELLS = 1024, 66
rng = np.random.default_rng(2417)
yy, xx = np.mgrid[:SIZE, :SIZE].astype(np.float32) / SIZE
tau = np.pi * 2
# Warp the irregular cells so the grain does not read as a regular polygon grid.
x = xx * CELLS + .28 * np.sin(tau * yy * 7) + .17 * np.sin(tau * (xx * 11 + yy * 4)) + .10 * np.sin(tau * (xx * 63 + yy * 39))
y = yy * CELLS + .26 * np.sin(tau * xx * 6) + .16 * np.cos(tau * (yy * 13 - xx * 3)) + .10 * np.cos(tau * (yy * 71 - xx * 32))
ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
seeds = rng.uniform(.06, .94, (CELLS, CELLS, 2))
weights = rng.uniform(-.18, .18, (CELLS, CELLS))
first = np.full((SIZE, SIZE), np.inf)
second = first.copy()
for dy in range(-1, 2):
    for dx in range(-1, 2):
        sx, sy = ix + dx, iy + dy
        jitter = seeds[sy % CELLS, sx % CELLS]
        distance = np.hypot(x - sx - jitter[..., 0], y - sy - jitter[..., 1]) + weights[sy % CELLS, sx % CELLS]
        second = np.minimum(second, np.maximum(first, distance))
        first = np.minimum(first, distance)
edge = (second - first) * .5
relief = 1 - np.exp(-np.power(edge / .075, .9))
height = relief * (.83 + .17 * np.clip(1 - first, 0, 1))
micro = rng.normal(0, .012, (SIZE, SIZE))
height += micro + .018 * np.sin(xx * tau * 131) * np.cos(yy * tau * 117)
dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 1.0
dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 1.0
normal = np.stack((-dx, dy, np.ones_like(dx)), axis=-1)
normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
variation = np.sin(tau * (xx * 3 + yy * 2)) * np.cos(tau * (yy * 5 - xx))
color = np.clip(237 + height * 15 + variation * 2, 0, 255).astype('uint8')
roughness = np.clip(216 - height * 37 + micro * 80, 0, 255).astype('uint8')
out = Path(__file__).resolve().parents[1] / 'public/assets/materials'
out.mkdir(parents=True, exist_ok=True)
Image.fromarray(np.repeat(color[..., None], 3, axis=-1)).save(out / 'pebbled-leather-color.webp', quality=92, method=6)
# High-quality data maps retain the small grain without a multi-megabyte PNG.
Image.fromarray(((normal * .5 + .5) * 255).astype('uint8')).save(out / 'pebbled-leather-normal.webp', quality=95, method=6)
Image.fromarray(roughness).save(out / 'pebbled-leather-roughness.webp', quality=95, method=6)
print('Generated three 1024px seamless pebbled-leather maps in', out)
