# Contributing

## Getting set up

```bash
make init
make test
```

Node 26 (`nvm use`). `make test` runs vitest: the logic in Node and every Storybook story, with
its `play`, in the Chrome you have installed.

## Before you open a pull request

```bash
make verify-format
make typecheck
make test
```

`make verify-format` formats, lints and runs `doctor`, then fails if any of
that left the tree dirty — the same check CI runs.

## What a good change looks like

- **A test that would fail without it.**
- **Read `AGENTS.md` first.** It says where things go and what the build enforces.
- **A reason in the code.** Exported symbols carry a JSDoc block saying why the thing is the
  way it is; a comment that repeats the signature is noise.
- **Self-imports, not relative ones.** Source inside a package imports itself as
  `@sincpro/web-framework/...`, without the `.ts`/`.tsx` extension — `make doctor` catches both.

## Versions

Versions are set by the release pipeline, never by hand in a pull request.
