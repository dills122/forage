# JavaScript And ESM Rules

This repository uses modern ESM JavaScript and TypeScript.

## ESM Compatibility

Rules:

- Keep all new code ESM compatible.
- Use `import` and `export`.
- Do not introduce `require()` or `module.exports`.
- Prefer `import.meta.url` based path handling instead of `__dirname` patterns.

## Built-In Imports

Use explicit `node:` imports for built-ins.

```js
import fs from 'node:fs';
import path from 'node:path';
```

## CLI Boundaries

CLI entry points should remain thin wrappers.

CLI responsibilities:

- parse arguments
- call importable business logic
- write outputs
- set exit codes at the edge

Core modules should not call `process.exit()`.

## Function Design

Prefer small helpers with clear names over dense inline conditionals.

Avoid generic names such as `processData` or `handleData`.

## State Management

- Default to `const`.
- Use `let` only when mutation is required.
- Avoid top-level mutable state unless it is an intentional narrow cache.
- Avoid mutating function inputs.

## Data Transformations

Normalize parsed input at the boundary and keep downstream object shapes stable.

Prefer:

- explicit mapping
- explicit field conversion
- one-time normalization near parsing

## Error Handling

Reusable modules should throw structured errors or return structured results.

The CLI or route layer decides whether to retry, skip, or abort.

## Dependencies And Abstractions

Prefer straightforward modern JavaScript.

Avoid:

- heavy frameworks unless already part of the project
- framework-like utility layers
- clever abstractions for one-off behavior
