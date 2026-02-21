# CLAUDE.md — vscode-sieve-formatter

This file documents conventions, commands, and architectural decisions for working on this VS Code extension with Claude Code.

## Project Overview

A VS Code formatter extension for Sieve email filter scripts (RFC 5228). Used primarily for Proton Mail rules. Formatter features:

1. **Remove trailing commas** from string lists `["a", "b",]` → `["a", "b"]`
2. **Expand multi-item lists** to multi-line for clean git diffs (2+ items)

## Key Architecture

```
src/
  formatter.ts     ← pure functions (no VS Code API) — test this directly
  extension.ts     ← VS Code glue code, imports formatter.ts
  test/
    formatter.test.ts  ← mocha unit tests for formatter.ts
language-configuration.json  ← bracket/comment config for the sieve language
```

**Critical principle**: all formatting logic lives in `formatter.ts` with no VS Code imports. This keeps business logic easily testable without a VS Code instance.

## Development Commands

```bash
npm run compile      # one-off TypeScript compile
npm run watch        # watch mode for development
npm run lint         # ESLint check
npm test             # run unit tests (mocha, no VS Code required)
npm run test:ci      # lint + compile + test (what CI runs)
```

To launch the extension in a VS Code Extension Development Host: press **F5** (uses `.vscode/launch.json`).

## Testing

Tests are plain mocha unit tests against `src/formatter.ts`. They require no VS Code instance and run directly in Node via `ts-node`.

```bash
npm test
```

**Test philosophy:**
- Test each formatting function in isolation (`removeTrailingCommas`, `expandListsToMultiline`)
- Test `formatDocument` with realistic Sieve snippets end-to-end
- Edge cases to always cover: strings containing commas, already-formatted input (idempotency), empty input, single-item lists (must not expand)

**Adding tests:** add cases to `src/test/formatter.test.ts`. No test runner config needed — mocha picks up all `*.test.ts` files under `src/test/`.

### What NOT to write integration tests for (yet)

VS Code integration tests (using `@vscode/test-electron`) spin up a full VS Code host and are significantly harder to set up in CI. They're not needed while all formatting logic is pure. Add them only if you need to test VS Code-specific behaviour (e.g. `FormattingOptions` being passed correctly, `onSave` triggers).

## Linting

ESLint with `@typescript-eslint`. Config in `.eslintrc.json`. Runs on `src/**/*.ts`. The CI pipeline blocks on lint errors.

```bash
npm run lint
```

Common issues:
- Unused variables: prefix with `_` or remove
- `@typescript-eslint/naming-convention`: imports must be camelCase or PascalCase

## Packaging & Publishing

```bash
npm install -g @vscode/vsce   # install the VS Code extension CLI (once)
vsce package                   # produces a .vsix file
vsce publish                   # publish to Marketplace (requires PAT)
```

`.vscodeignore` controls what lands in the `.vsix`. Source files, tests, and config are excluded — only `out/` and `language-configuration.json` are shipped.

The `.vsix` file is excluded from git (`.gitignore`).

## GitHub Workflow

- **Main branch**: `main` (or `master`)
- **Feature branches**: branch off `main`, open a PR, merge via squash
- **CI**: GitHub Actions runs lint + compile + tests on every push and PR (see `.github/workflows/ci.yml`)
- **Commit messages**: imperative mood, present tense — `fix trailing comma regex`, `add multi-line list expansion`
- Never commit `out/`, `node_modules/`, or `.vsix` files

### PR checklist

- [ ] `npm run test:ci` passes locally before pushing
- [ ] New behaviour covered by tests in `src/test/formatter.test.ts`
- [ ] `.vscodeignore` updated if new files are added that should not ship

## Sieve Language Notes

Relevant RFC 5228 constructs this formatter handles:

```sieve
require ["fileinto", "imap4flags"];        # string list → expand to multi-line

if address :is "From" "alice@example.com" {
  fileinto "INBOX";
}

if address :is "From" ["alice@example.com", "bob@example.com"] {
  fileinto "Team";
}
```

- String lists use `[...]`, not `(...)`
- Tagged arguments (`:is`, `:contains`, `:matches`) are not affected by the formatter
- Single-string arguments are left as-is; only 2+ item lists are expanded

## Roadmap

See `README.md` for planned features. Next priorities:

1. Handle edge case: list items that are already on their own lines but have inconsistent indentation (normalise indent)
2. Consider a `sieve.formatter.expandLists` setting to let users opt out of multi-line expansion
3. Syntax highlighting (separate contribution point — `grammars`)
