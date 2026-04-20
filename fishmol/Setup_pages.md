## Rebuilding the Jupyter Book docs
You're using Jupyter Book with execute_notebooks: off, so Jupyter Book converts the pre-executed notebooks directly — it does not re-run them. The build just needs to happen on master and the output pushed to gh-pages.

### Option A — Manually (one-time or occasional)

#### 1. Install Jupyter Book if you haven't
```
pip install jupyter-book ghp-import
```

#### 2. Build from the repo root (on master branch)
```
jupyter-book build docs/
```

#### 3. Push the built HTML to gh-pages
```
ghp-import -n -p -f docs/_build/html
```

ghp-import force-pushes only the docs/_build/html folder to your gh-pages branch. The -n flag adds a .nojekyll file (required for GitHub Pages to serve Jupyter Book output correctly).

Your site will be live at https://lei-lei-alpha.github.io/fishmol within a minute or two.

### Option B — GitHub Actions (automated, recommended)
Create .github/workflows/docs.yml so the site rebuilds automatically on every push to master:

```yaml
name: Build and deploy docs

on:
  push:
    branches: [master]

jobs:
  build-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install "jupyter-book<2" ghp-import
          pip install -e ".[vis]"

      - name: Build book
        run: jupyter-book build docs/

      - name: Deploy to gh-pages
        run: ghp-import -n -p -f docs/_build/html
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```