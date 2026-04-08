# Contributing to Mettig

Thanks for your interest in contributing to Mettig! This guide will help you get started.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mettig.git
   cd mettig
   ```

3. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Make your changes** and test locally

6. **Push to your fork** and **create a Pull Request**

## 🧪 CI/CD Pipeline

Our GitHub Actions CI pipeline runs automatically on:
- ✅ Every **push to main/develop** branches
- ✅ Every **pull request** to main/develop branches

### Pipeline Jobs

The CI pipeline includes these parallel jobs:

#### 1. **Backend**
- Linting (ESLint)
- Type checking (TypeScript)
- Building (tsc)
- Unit tests (Jest)

```bash
cd backend && npm run lint && npm run typecheck && npm run build && npm run test
```

#### 2. **Mobile Client** (React Native + Expo)
- Type checking (TypeScript)
- Linting (ESLint)

```bash
cd apps/client && npm run typecheck && npm run lint
```

#### 3. **Mobile Business** (React Native + Expo)
- Type checking (TypeScript)
- Linting (ESLint)

```bash
cd apps/business && npm run typecheck && npm run lint
```

#### 4. **Web Application** (React + Vite)
- Type checking (TypeScript)
- Linting (ESLint)
- Building (Vite)

```bash
cd apps/web && npm run typecheck && npm run lint && npm run build
```

#### 5. **Shared Package**
- Type checking (TypeScript)
- Linting (ESLint)

```bash
cd packages/shared && npm run typecheck && npm run lint
```

#### 6. **Format Check**
- Code formatting check (Prettier)

```bash
npm run format:check
```

## 📋 Before Submitting a Pull Request

Make sure your code passes all local checks:

```bash
# Lint all workspaces
npm run lint --workspaces --if-present

# Type check all workspaces
npm run typecheck --workspaces --if-present

# Build everything
npm run build --workspaces --if-present

# Format code
npm run format
```

## 🎯 Code Standards

### TypeScript
- ✅ **Strict mode required**: `strict: true` in tsconfig.json
- ✅ **No `any` types** unless absolutely necessary (with `@ts-expect-error` comment)
- ✅ **Type all function parameters and returns**

### Naming Conventions
- **Files**: `kebab-case` (e.g., `user-service.ts`)
- **Components**: `PascalCase` (e.g., `UserCard.tsx`)
- **Variables & functions**: `camelCase` (e.g., `getUserData()`)
- **Database tables**: `snake_case` (e.g., `user_bookings`)
- **API endpoints**: `kebab-case` (e.g., `/user-profile`)
- **i18n keys**: dot-notation (e.g., `home.searchPlaceholder`)

### Code Style
- Use **Prettier** for automatic formatting
- Follow **ESLint** rules
- Write **meaningful commit messages**
- Add **unit tests** for critical code

### Git Commit Messages

Use conventional commits format:

```
feat(scope): description        # New feature
fix(scope): description         # Bug fix
docs(scope): description        # Documentation
style(scope): description       # Formatting
refactor(scope): description    # Code restructuring
test(scope): description        # Tests
chore(scope): description       # Build, deps, etc.
```

Examples:
```bash
git commit -m "feat(auth): add SMS code verification"
git commit -m "fix(booking): resolve timezone issue"
git commit -m "docs(readme): add Docker setup instructions"
```

## 🐛 Reporting Bugs

If you find a bug, please:

1. **Check existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear title describing the bug
   - Step-by-step reproduction
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

## 💡 Suggesting Features

Have an idea? We'd love to hear it:

1. **Check existing issues** to see if it's already proposed
2. **Create a new issue** with:
   - Clear feature description
   - Use cases and examples
   - How it fits with existing functionality

## 📚 Development Workflow

### Working on a Feature

```bash
# 1. Create and checkout feature branch
git checkout -b feature/my-feature

# 2. Install dependencies
npm install

# 3. Run development server (if needed)
npm run dev --workspace=backend

# 4. Make changes and test
npm run lint --workspaces
npm run typecheck --workspaces

# 5. Commit changes
git commit -m "feat(module): add my feature"

# 6. Push and create PR
git push origin feature/my-feature
```

### Testing

```bash
# Run backend tests
cd backend && npm run test

# Run with coverage
npm run test -- --coverage

# Watch mode
npm run test -- --watch
```

### Database Migrations

If you modify the database schema:

```bash
# Create new migration
touch backend/src/db/migrations/2024-04-08-add-new-table.ts

# Run migrations
docker-compose exec backend npm run db:migrate

# Rollback last migration
docker-compose exec backend npm run db:rollback
```

## 🚀 Deployment

After your PR is merged to `main`:

1. ✅ CI pipeline runs automatically
2. ✅ If all checks pass, code is ready to deploy
3. ✅ Deployment to VPS happens via CD pipeline (TASK-038 expansion)

## 📞 Getting Help

- **GitHub Issues**: Ask questions in issue discussions
- **Documentation**: Check README.md and inline code comments
- **Slack/Telegram**: Reach out to the team

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Mettig! 🙏**
