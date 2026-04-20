# Publishing FishMol to PyPI

This guide walks through every step to publish FishMol on PyPI — from account setup to a repeatable release workflow.

---

## 1. Prerequisites

Install the build and upload tools:

```bash
pip install build twine
```

Verify you have a clean working tree:

```bash
git status          # should be clean
git log --oneline -5
```

---

## 2. PyPI Account Setup (one-time)

### 2a. Create accounts

- **PyPI** (production): https://pypi.org/account/register/
- **TestPyPI** (sandbox): https://test.pypi.org/account/register/

Enable two-factor authentication (2FA) on both — it is now mandatory for publishing.

### 2b. Create API tokens (recommended over passwords)

1. Log in to PyPI → **Account settings** → **API tokens** → **Add API token**
2. Scope: **Entire account** for the first publish; then narrow to the `fishmol` project for subsequent releases
3. Copy the token (shown only once, starts with `pypi-`)

Repeat for TestPyPI.

### 2c. Store credentials

Create (or append to) `~/.pypirc`:

```ini
[distutils]
index-servers =
    pypi
    testpypi

[pypi]
repository = https://upload.pypi.org/legacy/
username = __token__
password = pypi-<your-pypi-token>

[testpypi]
repository = https://test.pypi.org/legacy/
username = __token__
password = pypi-<your-testpypi-token>
```

Restrict file permissions so only your user can read it:

```bash
chmod 600 ~/.pypirc   # Linux/macOS
```

Windows: Properties → Security → remove all but your user account. Or, use powershell

```powershell
$path = "$HOME\.pypirc"
$acl = Get-Acl $path

# 1. Disable inheritance (copy current rules so we can edit them)
$acl.SetAccessRuleProtection($true, $false)

# 2. Filter out 'Users' and 'Everyone' from the Access list
$newAccessRules = $acl.Access | Where-Object { 
    $_.IdentityReference -notlike "*Users" -and 
    $_.IdentityReference -notlike "*Everyone" 
}

# 3. Create a fresh ACL and add back only the filtered rules
$newAcl = New-Object System.Security.AccessControl.FileSecurity
foreach ($rule in $newAccessRules) {
    $newAcl.AddAccessRule($rule)
}

# 4. Apply the cleaned-up ACL back to the file
Set-Acl $path $newAcl
```

---

## 3. Prepare the Release

### 3a. Verify package metadata

```bash
python -c "import tomllib; d=tomllib.load(open('pyproject.toml','rb')); print(d['project']['version'])"
```

Check the version string follows [PEP 440](https://peps.python.org/pep-0440/):

| Stage | Example |
|-------|---------|
| Alpha | `0.1.0a1` |
| Beta | `0.1.0b1` |
| Release candidate | `0.1.0rc1` |
| Stable | `0.1.0` |

Edit `pyproject.toml` to bump `version` before each release.

### 3b. Tag the commit in Git

```bash
git tag -a v0.0.1 -m "Release v0.0.1"
git push origin v0.0.1
```

PyPI does not read Git tags automatically, but tagging keeps your release history clean and lets GitHub auto-generate release notes.

---

## 4. Build the Distribution

```bash
# From the repo root (where pyproject.toml lives)
python -m build
```

This produces two files in `dist/`:

| File | What it is |
|------|-----------|
| `fishmol-0.0.1.tar.gz` | Source distribution (sdist) — contains raw Python source |
| `fishmol-0.0.1-py3-none-any.whl` | Wheel — pre-built, installs faster |

Always ship both. PyPI uses the wheel for installation by default; the sdist is required for reproducibility and source audits.

### 4a. Inspect the sdist contents

```bash
tar tzf dist/fishmol-0.0.1.tar.gz | head -40
```

Windows, powershell
```powershell
tar tzf dist/fishmol-0.0.1.tar.gz | Get-Content -TotalCount 40
```

Confirm that:
- All `fishmol/` submodules are present (`atoms.py`, `trj.py`, `funcs.py`, `dimer.py`, `utils.py`, `msd.py`, `vis.py`, `cages/`)
- `LICENSE`, `README.md`, and `pyproject.toml` are included
- No secrets, large data files, or bytecode (`.pyc`) are present

### 4b. Validate metadata

```bash
twine check dist/*
```

Fix any `CRITICAL` or `ERROR` messages before uploading. Warnings about the description (e.g., invalid RST) show up as rendering problems on the PyPI project page.

---

## 5. Test on TestPyPI First

Upload to the sandbox to verify the whole pipeline without touching the real index:

```bash
twine upload --repository testpypi dist/*
```

Install from TestPyPI in a fresh virtual environment:

```bash
python -m venv /tmp/test_env
source /tmp/test_env/bin/activate          # Windows: /tmp/test_env/Scripts/activate
pip install --index-url https://test.pypi.org/simple/ \
            --extra-index-url https://pypi.org/simple/ \
            fishmol
python -c "import fishmol; print('OK')"
```

The `--extra-index-url` flag is needed because TestPyPI does not mirror the full PyPI index, so runtime dependencies (numpy, scipy, etc.) are fetched from real PyPI.

---

## 6. Publish to PyPI

Once TestPyPI looks correct:

```bash
twine upload dist/*
```

The package is now live at `https://pypi.org/project/fishmol/`.

Verify the install:

```bash
pip install fishmol
python -c "import fishmol; print(fishmol.__version__)"
```

---

## 7. Trusted Publishing (Optional but Recommended)

[Trusted Publishing](https://docs.pypi.org/trusted-publishers/) lets GitHub Actions publish without storing tokens in secrets.

### 7a. Configure on PyPI

1. Go to your PyPI project → **Manage** → **Publishing**
2. Add a **GitHub** trusted publisher:
   - Owner: `Lei-Lei-alpha`
   - Repository: `FishMol`
   - Workflow: `publish.yml`
   - Environment: `release` (optional but recommended)

### 7b. Create `.github/workflows/publish.yml`

In the root directory of the repository, creat `.github/workflows/publish.yml`
```yaml
name: Publish to PyPI

on:
  push:
    tags:
      - "v*"

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    environment: release
    permissions:
      id-token: write   # required for trusted publishing

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install build tools
        run: pip install build

      - name: Build
        run: python -m build

      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@release/v1
```

With this workflow, pushing a tag matching `v*` triggers an automatic build and publish — no tokens required.

---

## 8. Post-Release Checklist

- [ ] `git tag -a vX.Y.Z -m "Release vX.Y.Z"` and `git push origin vX.Y.Z`
- [ ] Create a GitHub Release from the tag (auto-generates changelog from commits)
- [ ] Bump `version` in `pyproject.toml` to the next development version (e.g., `0.0.2.dev0`)
- [ ] Update documentation if the public API changed

---

## 9. Repeat Release Workflow (TL;DR)

```bash
# 1. Bump version in pyproject.toml
# 2. Commit and tag
git add pyproject.toml
git commit -m "Bump version to 0.0.2"
git tag -a v0.0.2 -m "Release v0.0.2"
git push origin master --tags

# 3. Clean old build artefacts
rm -rf dist/ build/

# 4. Build
python -m build

# 5. Validate
twine check dist/*

# 6. Publish
twine upload dist/*
```

---

## 10. Package Structure Reference

The final, PyPI-ready structure:

```
fishmol/                  ← installed package
├── __init__.py
├── __main__.py           ← `fishmol` CLI entry-point
├── atoms.py
├── trj.py
├── funcs.py
├── dimer.py
├── msd.py
├── utils.py
├── vis.py
├── style.py
└── cages/
    ├── __init__.py
    ├── c1_at_dict.py
    └── c2_at_dict.py
pyproject.toml            ← PEP 517/518/621 metadata
README.md                 ← rendered on PyPI project page
LICENSE                   ← GPL v3
PUBLISHING.md             ← this file
docs/                     ← Jupyter Book source (not shipped in wheel)
```

> **Note on ASE dependency**: `ase` (the visualisation backend) is in the `[vis]` extra, not in core dependencies, because it is optional and has a heavy install footprint. Users who only need analysis functions do not need it. Install it with `pip install fishmol[vis]`.
