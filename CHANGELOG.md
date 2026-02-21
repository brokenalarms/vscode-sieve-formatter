# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Sorted `require`** (`sieve.formatter.sortRequire`, default off) — sorts extensions inside `require [...]` alphabetically (case-insensitive) before any expansion pass.
- Extension icon (tabler `filter-spark`, 128×128 PNG).

## [0.2.0]

### Added

- **Syntax highlighting** — full TextMate grammar for Sieve (RFC 5228): keywords, actions, tests, tagged arguments, strings, block and line comments, numbers with quantifiers, punctuation.
- **Block indentation** (`sieve.formatter.indentBlocks`) — re-indents `if`, `elsif`, and `else` block bodies based on `{`/`}` nesting depth.
- **`} elsif` / `} else` joining** (`sieve.formatter.joinElsifElse`) — merges a lone `}` line with a following `elsif` or `else` onto one line.
- **Multi-line list indentation normalisation** — re-indents existing multi-line `[...]` lists so items align consistently relative to their opening bracket.
- **Blank line normalisation** (`sieve.formatter.normalizeBlankLines`) — collapses runs of more than one consecutive blank line into a single blank line.
- Block comment preservation — interior lines of `/* ... */` comments are not re-indented.

### Changed

- Block comment (`/* ... */`) and line comment (`#`) toggling now available via the standard VS Code comment commands.
- Language-configuration improvements: block comment definition, surrounding pairs for `{`, `[`, `"`, folding markers for block comments, word pattern.

## [0.1.0]

### Added

- **Trailing comma removal** — strips `,` immediately before `]` or `)`, string-aware.
- **Multi-item list expansion** (`sieve.formatter.expandLists`) — single-line `[...]` lists with two or more items are expanded to one-item-per-line.
- **`require` opt-in expansion** (`sieve.formatter.alwaysExpandRequire`) — applies the same expansion rule to `require [...]`.
- `.sieve` file association and language registration.
- Format on save support via VS Code's built-in formatting pipeline.
