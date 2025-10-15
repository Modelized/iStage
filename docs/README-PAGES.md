
# GitHub Pages — iStage site (with /releases and /help)

## Publish (existing repo)
1) Copy this `docs/` folder into your repo root.
2) Commit & push:
   ```bash
   git add docs
   git commit -m "Add Pages site (releases + help)"
   git push origin main
   ```
3) GitHub → Settings → Pages → Deploy from a branch → `main` / `/docs`

### Routes
- `/` (home)
- `/iStage-26/`, `/iStage-18/`
- `/compare/`
- `/releases/` (downloads + changelog; fetches GitHub Releases)
- `/help/` (setup + tips/answers in one page)
- `/gallery/`
- `/legal/`

### Configure Releases
Edit at top of `docs/releases/index.html`:
```js
const GH_OWNER = "Modelized";
const GH_REPO  = "iStage";
```
