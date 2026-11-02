# Evaluating Long-Horizon Robot Planning under Uncertainty

Project page for the CoRL 2026 LEAP Workshop paper by Harsh Muriki, Gayathri Aravindan, Yuchen Zheng, and Sonia Chernova (Georgia Tech).

Live site: https://harshmuriki.github.io/leap-planning-uncertainty/

## Editing

Plain static HTML/CSS/JS with no build step.

- `index.html` holds the content. Unfinished pieces are marked `<!-- TODO -->`.
- `style.css` and `main.js` are linked with a `?v=N` suffix. Bump N after editing them so browsers don't serve a stale copy.
- Task rollout clips go in `static/videos/t1.mp4` … `t7.mp4`. Each task card picks up its clip automatically and plays it on hover.

Preview locally:

```bash
python3 -m http.server 8000
```
