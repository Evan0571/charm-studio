# 3D preview assets

Updated 2026-10-08. The 3D prototype uses original bag geometry with photographed leather material maps and a captured studio lighting environment. The bags are illustrative, unbranded 3D designs; they are not scans of specific commercial bags or verified manufacturing dimensions.

## Original geometry

| File | Description | Inner hanging contact in GLB local coordinates |
| --- | --- | --- |
| `public/assets/models/atelier-tote.glb` | Open cognac leather tote, suede lining, rolled top handles, stitched leather tabs, piping, brass hardware | `[1.72, 0.332, 0.69]` |
| `public/assets/models/atelier-shoulder.glb` | Ivory shoulder bag, lining, rounded flap, clasp, strap, side piping | `[1.55, 0.282, 0.70]` |

Both files contain a `charm_attachment` empty node at the lowest **inside surface** of the structural D-ring. This is the contact where a hanging connector bears weight, not the ring center or the connector's outer tip. GLB coordinates are Y-up, front +Z. Preview units are arbitrary: tote width is 4.4, body extends from Y=-1.7 to Y=0.7; shoulder width is 3.82, body extends from Y=-1.7 to Y=0.55. No branded logo or product photo is included.

The D-ring is fixed to the bag by a folded leather keeper: its sewn ends rest on the leather panel, and the middle passes behind, under, and in front of the horizontal brass bar. This replaces the earlier decorative floating torus. Every D-ring lies in the XY plane (normal +Z), has a downward semicircle with centerline radius 0.14 and wire radius 0.022. The top-bar centers are `[1.72, 0.45, 0.69]` for tote and `[1.55, 0.40, 0.70]` for shoulder. The pure module `src/three/bagAttachment.ts` supplies `bagAttachmentPose` for the viewer and geometry regression tests, and `bags.tsx` re-exports it. The mini bag uses the same construction with bar center `[0.82, -0.16, 0.525]` and inner hanging contact `[0.82, -0.278, 0.525]`.

The mini bag's shell and continuous folded flap are generated in `src/three/miniBagGeometry.ts`. The flap follows the rounded body from the front over the crown onto the back, with a 0.036-unit leather thickness and a slightly embedded underside. Quilt seams follow the actual rounded front surface and end beneath the flap. Collision uses the rounded shell plus a hull of the folded flap. Geometry tests raycast the rendered meshes to verify surface contact at the sides, bottom corners, and top fold.

All three bags support preview-only custom colors. Per-instance material clones keep the GLTF cache and original colors intact. Custom leather colors retain normal and roughness maps; the tote's brown albedo is omitted when tinting to avoid contaminating the selected pigment. Edge paint and stitching follow the chosen color; hardware and lining retain their original materials. Choosing Original restores the original albedo as well as its base color.

Geometry was authored for this project in Blender. The source script is `scripts/build-bags.py`. Editable `.blend` files are in `assets-source/`; 600 px beauty review renders are in `docs/asset-previews/`. These source and review files are outside the website's public directory. The original script and geometry have no third-party model license requirement; their embedded leather textures retain the CC0 provenance below.

Rebuild from the repository root (Blender 5.2.2 LTS used for the checked-in output):

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build-bags.py
```

Each GLB embeds its textures and works without remote texture requests. Source materials are also separately available for the procedural charms and leather straps in the viewer. The `.blend` files reference those materials using repository-relative paths; the generator resolves its inputs from the repository structure. Body UVs use perimeter arc length to avoid stretched grain across the broad front panel, and the normal strength is kept at 0.14.

The tote has 34,340 triangles and the shoulder bag has 24,820. Each uses five mesh nodes and six material primitives, including the interior lining. The exports were inspected for valid GLB headers, embedded image buffers, normal and roughness texture references, and the attachment node. Beauty renders were visually reviewed in Blender with the same studio HDRI used by the web preview. Rim binding, side piping and saddle stitches are projected onto the bag shell so they remain attached in side views. Attachment metadata records the D-ring plane, wire radius and centerline radius, and matches the viewer's hanging-contact coordinates.

## Third-party materials and lighting

All four downloads below were obtained from Poly Haven's official asset download URLs on 2026-10-08. Their MD5 values match the official metadata returned by the linked asset file API. **CC0 allows use, modification and redistribution**, including commercial use; credit is retained here voluntarily. Asset licenses were confirmed on each asset page and on [Poly Haven's asset license page](https://polyhaven.com/license). The license applies to assets, not the site's logos or example renders; none of those site images are included.

### Brown Leather — Rob Tuytel / Poly Haven

- Asset: [Brown Leather](https://polyhaven.com/a/brown_leather)
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Official metadata: [files/brown_leather](https://api.polyhaven.com/files/brown_leather)
- Source material represents a 0.4 m tile; preview UV repetition is artistic and does not calibrate the bag to physical scale.

| Local path under `public/assets/materials/` | Map / color space | Bytes | MD5 |
| --- | --- | ---: | --- |
| `brown-leather-color.jpg` | Albedo, sRGB, 1024×1024 | 503348 | `080b3bf1372766ff2c7ff121ed07b5e8` |
| `brown-leather-normal.jpg` | OpenGL tangent-space normal, linear data, 1024×1024 | 863280 | `b63ae0121a415c23d74eed0b07fc6065` |
| `brown-leather-roughness.jpg` | Roughness, linear data, 1024×1024 | 686142 | `0f3a0148c8d2d25fbeca67e64e79bca0` |

Exact downloads:

- [Albedo JPEG](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_leather/brown_leather_albedo_1k.jpg)
- [OpenGL normal JPEG](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_leather/brown_leather_nor_gl_1k.jpg)
- [Roughness JPEG](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_leather/brown_leather_rough_1k.jpg)

The source JPEG files are unchanged. The tote GLB embeds albedo, normal and roughness maps. The ivory bag uses an original ivory base color and the scanned normal and roughness maps. Blender's glTF exporter packs the roughness channel into its generated metallic-roughness texture as needed.

### Studio Small 09 — Sergej Majboroda / Poly Haven

- Asset: [Studio Small 09](https://polyhaven.com/a/studio_small_09)
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Official metadata: [files/studio_small_09](https://api.polyhaven.com/files/studio_small_09)
- Local path: `public/assets/environment/studio-small-09-1k.hdr`
- Exact download: [1K Radiance HDR](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr)
- Size: 1615248 bytes, 1024×512. MD5: `d5d7eb9d26d341d6aa4d11c1a54fd97c`.
- Unmodified linear HDR lighting data. Used for image-based illumination and metal reflections, not as a visible photographic bag background.

## Scope and future asset replacement

The 14 charm/bead meshes in `src/three/parts.tsx` and the small quilted bag in `src/three/bags.tsx` are original procedural geometry. They use the same local materials and lighting as the live preview. `public/assets/thumbnails/` contains 17 PNG renders (14 parts, 3 starter assemblies), exported through the project's `/asset-studio` authoring page; these are not AI-generated product photographs. To regenerate them, open that page, select “渲染全部缩略图”, then download its JSON data and decode each PNG data URL to its named file.

No third-party handbag mesh was downloaded: readily available candidates were either cartoon-like, required a separate sign-in, or did not have a sufficiently clear model-specific license for this prototype. The original Blender models provide an immediately editable baseline with consistent attachment points. Product-specific scans, real measured dimensions, more detailed stitched leatherwork and draping can replace these GLBs later without changing the order or catalog data.

The previews show materials and general proportion. They do not yet establish exact color matching to a physical bag, fabric deformation, or manufacturing fit.
