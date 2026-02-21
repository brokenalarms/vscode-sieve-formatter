# CLAUDE.md — vscode-sieve-formatter

## Architecture

All formatting logic lives in `src/formatter.ts` with **no VS Code imports**. `src/extension.ts` is purely glue — it reads VS Code document state and settings, calls the formatter, and returns edits. This separation means the business logic is testable with plain mocha and no VS Code host.

```
src/
  formatter.ts      ← pure functions, no VS Code API
  extension.ts      ← VS Code glue only
  test/
    formatter.test.ts
```

## How the formatter works

Three passes run in order:

1. **`removeTrailingCommas`** — strips `,` immediately before `]` or `)`. General regex, not limited to quoted strings.

2. **`expandListsToMultiline`** — any `[...]` on a single line with 2+ comma-separated items is expanded to one-item-per-line. Single-item lists are left alone. Already-multi-line content (contains `\n`) is not re-processed. `require [...]` is skipped by default (see pass 3).

3. **`require` opt-in** — `alwaysExpandRequire` (default off) opts `require` into the same expansion rule as every other list: 2+ items expand, single item stays collapsed. When the setting is off, `require` is left on one line regardless of how many extensions it lists. Passing `skipRequire = false` to `expandListsToMultiline` is the mechanism.

`formatDocument` accepts a `FormatOptions` object (`indent`, `alwaysExpandRequire`) and runs all passes. `extension.ts` builds this object from VS Code's `FormattingOptions` and `workspace.getConfiguration`.

## Testing philosophy

Tests cover each formatter function in isolation, then `formatDocument` end-to-end. Every new behaviour needs:
- A positive case (it transforms correctly)
- An idempotency case (running again produces the same output)
- Edge cases relevant to that function (commas inside strings, already-formatted input, single vs multi item)

Avoid VS Code integration tests (`@vscode/test-electron`) unless testing something that genuinely requires a running editor — the formatter has no such dependency.

## VS Code settings

Settings are declared in `package.json` under `contributes.configuration` and read in `extension.ts` via `vscode.workspace.getConfiguration('sieve.formatter')`. Add new settings there; do not hard-code behaviour that users might want to control.

Current settings:
- `sieve.formatter.alwaysExpandRequire` (bool, default `false`)

## Packaging

`.vscodeignore` controls what ships in the `.vsix`. Source, tests, and config files are excluded — only compiled output and `language-configuration.json` are included. The `.vsix` itself is git-ignored.

## GitHub workflow

- One PR per feature; CI must be green before merging
- Commit messages: imperative, present tense (`add require expansion setting`)
- Never commit `out/`, `node_modules/`, or `.vsix`

## Sieve language notes

Standard Sieve (RFC 5228) uses `[...]` for string lists — there are no `()`-style function calls. Tagged arguments (`:is`, `:contains`, `:matches`) are not affected by any formatter pass. The `require` command is always the first statement and lists extension dependencies.

## Roadmap

- Normalise already-multi-line lists with inconsistent indentation
- `sieve.formatter.expandLists` setting to opt out of multi-line expansion entirely
- Syntax highlighting (`.tmLanguage.json` grammar)
