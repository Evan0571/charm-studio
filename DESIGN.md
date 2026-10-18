# LOOP interface design

Current design notes, October 18, 2026. The implemented styling is defined in `src/atelier.css`, `src/landing-editorial.css`, `src/ai-atelier.css` and `src/chatgpt/widget.css`.

## Direction

A quiet accessories atelier: warm paper surfaces, dark olive text, rust accents and generous product imagery. The 3D object and editable parts carry the visual focus. The website studio and conversation card share the same catalog and configuration, while their layouts fit their different host surfaces.

## Website palette

| Role | Value | Source |
| --- | --- | --- |
| Ink | `#252820` | `--ink` |
| Paper | `#f7f5f0` | `--paper` |
| Surface | `#fdfcf9` | `--surface` |
| Accent | `#b65e42` | `--accent` |
| Muted | `#75776d` | `--muted` |
| Rule | `#e5e4dc` | `--line` |

Editorial serif headings accompany readable sans-serif controls. Existing styles use system fallbacks and optional Google Fonts; no proprietary reference-brand typeface is bundled.

## Composition and interaction

- A large product viewport sits beside a compact editor on desktop; narrow layouts keep controls readable and avoid horizontal overflow.
- Visual part choices, selected state and locks show what can change and what will stay fixed.
- A stable price/action area connects editing with itemized review. Save and test confirmation remain distinct actions.
- Model loading, fallback and retry states should distinguish a valid configuration from a ready 3D frame.
- Keyboard focus, accessible control names and reduced-motion behavior belong to the interaction design.
- Product and bag views use illustrative, unbranded geometry. Preview colors, motion and scale do not imply manufacturing calibration.

## Screenshots and assets

The [README studio image](docs/images/studio.png) is captured from the running application. Original geometry and third-party materials/lighting are described in [ASSETS.md](docs/ASSETS.md). The [product brief](docs/PRD.md) defines current scope.

The earlier external marketplace reference has been replaced with these project-specific notes. Earlier iteration details remain in Git history and [historical plans](docs/plans/); current guidance comes from the implemented styles and product brief.
