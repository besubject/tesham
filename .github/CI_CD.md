# CI/CD Pipeline Documentation

## Overview

Mettig uses **GitHub Actions** for continuous integration and continuous deployment. The pipeline automatically runs on every push and pull request to validate code quality.

## 🔄 Workflows

### 1. **CI Workflow** (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs (run in parallel):**

| Job | Purpose | Commands |
|-----|---------|----------|
| **backend** | Lint, type-check, test, build | `lint` → `typecheck` → `test` → `build` |
| **client** | Mobile app type-checking | `typecheck` + `lint` |
| **business** | Mobile business app type-checking | `typecheck` + `lint` |
| **web** | Web panel type-check, build | `typecheck` → `lint` → `build` |
| **shared** | Shared package validation | `typecheck` + `lint` |
| **format** | Code formatting check | `format:check` |
| **ci-summary** | Pipeline summary | Status aggregation |

### 2. **Lint Workflow** (`.github/workflows/lint.yml`)

Runs on pull requests to provide linting feedback.

**Jobs:**
- ESLint on all workspaces
- Prettier formatting check

## 📊 Pipeline Triggers

```yaml
on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main
      - develop
```

**Triggers CI on:**
- ✅ Push to `main` branch
- ✅ Push to `develop` branch
- ✅ Pull request to `main` branch
- ✅ Pull request to `develop` branch

## 🚀 Job Details

### Backend Job

```yaml
working-directory: ./backend
```

**Steps:**
1. Checkout code
2. Setup Node.js 20.x
3. Install dependencies
4. Lint: `npm run lint`
5. Type-check: `npm run typecheck`
6. Test: `npm run test`
7. Build: `npm run build`

**Status:** ❌ FAILS if any step fails

### Mobile Client Job

```yaml
working-directory: ./apps/client
```

**Steps:**
1. Checkout code
2. Setup Node.js 20.x
3. Install dependencies
4. Type-check: `npm run typecheck`
5. Lint: `npm run lint` (optional)

**Status:** ❌ FAILS only if type-check fails

### Mobile Business Job

```yaml
working-directory: ./apps/business
```

**Steps:**
1. Checkout code
2. Setup Node.js 20.x
3. Install dependencies
4. Type-check: `npm run typecheck`
5. Lint: `npm run lint` (optional)

**Status:** ❌ FAILS only if type-check fails

### Web Application Job

```yaml
working-directory: ./apps/web
```

**Steps:**
1. Checkout code
2. Setup Node.js 20.x
3. Install dependencies
4. Type-check: `npm run typecheck`
5. Lint: `npm run lint` (optional)
6. Build: `npm run build`

**Status:** ❌ FAILS if type-check or build fails

### Shared Package Job

```yaml
working-directory: ./packages/shared
```

**Steps:**
1. Checkout code
2. Setup Node.js 20.x
3. Install dependencies
4. Type-check: `npm run typecheck`
5. Lint: `npm run lint` (optional)

**Status:** ❌ FAILS only if type-check fails

### Format Check Job

**Steps:**
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Check format: `npm run format:check`

**Status:** ⚠️ OPTIONAL (does not fail pipeline)

## 📈 Pipeline Status

### ✅ Success

All critical jobs pass:
- ✅ Backend lint, typecheck, test, build
- ✅ Client, Business typecheck
- ✅ Web typecheck, build
- ✅ Shared typecheck

### ❌ Failure

Pipeline fails if ANY critical job fails:
```
❌ Backend fails
   └─ Code doesn't compile or tests fail
❌ Client/Business typecheck fails
   └─ TypeScript errors in mobile apps
❌ Web typecheck or build fails
   └─ TypeScript errors or Vite build fails
❌ Shared typecheck fails
   └─ TypeScript errors in shared package
```

### 🔄 Concurrency

Concurrency is enabled to cancel older runs when new commits are pushed:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Effect:** If you push multiple commits quickly, only the latest one runs CI (saves compute time).

## 📝 Running Locally

### Before Committing

Run all checks locally:

```bash
# Lint all workspaces
npm run lint --workspaces --if-present

# Type-check all workspaces
npm run typecheck --workspaces --if-present

# Build all workspaces
npm run build --workspaces --if-present

# Check formatting
npm run format:check
```

### Specific Workspace

```bash
# Only backend
cd backend && npm run lint && npm run typecheck && npm run test && npm run build

# Only web
cd apps/web && npm run typecheck && npm run build

# Only client
cd apps/client && npm run typecheck
```

## 🐛 Debugging CI Failures

### Backend Job Fails

```bash
# Reproduce locally
cd backend
npm install
npm run lint        # Check for linting errors
npm run typecheck   # Check for TypeScript errors
npm run test        # Check for test failures
npm run build       # Check for build errors
```

### Web/Client Typecheck Fails

```bash
# Check TypeScript errors
npm run typecheck

# View detailed errors
npx tsc --noEmit
```

### Build Fails

```bash
# Web build
cd apps/web && npm run build

# Backend build
cd backend && npm run build
```

## 🔐 Protected Branches

Recommended GitHub branch protection settings for `main`:

```
✅ Require status checks to pass before merging
✅ Require all suggested changes to be resolved
✅ Require branches to be up to date before merging
✅ Require code reviews before merging
```

This ensures all CI checks pass before code is merged.

## 📊 Monitoring Builds

View CI status:
- **GitHub Actions tab**: https://github.com/mettig/mettig/actions
- **Per PR**: Check "Checks" tab in pull request
- **Badge in README**: (Add status badge when repo is public)

## 🚀 Future Enhancements (Roadmap)

- [ ] Deploy to staging on successful merge to `develop`
- [ ] Deploy to production on successful merge to `main`
- [ ] Code coverage reports
- [ ] Performance benchmarking
- [ ] Security scanning (SAST)
- [ ] Dependency vulnerability scanning
- [ ] Docker image building and pushing to registry

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Node.js Setup Action](https://github.com/actions/setup-node)
- [Checkout Action](https://github.com/actions/checkout)
- [Concurrency Documentation](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#concurrency)

---

**Questions?** Check CONTRIBUTING.md or open an issue.
