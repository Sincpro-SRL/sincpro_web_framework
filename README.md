# @sincpro/web-framework

The web client of [`sincpro_framework`](https://github.com/Sincpro-SRL/sincpro_framework): lists,
records and forms bound to the metadata each entity publishes — labels, types, what is
required, what a field points to — so an application names its fields and the rest follows.

```bash
yarn add @sincpro/web-framework react react-dom
```

Requires React 19 or newer.

| Package                  | The question it answers                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `@sincpro/web-ui`        | What a screen looks like                                            |
| `@sincpro/web-composer`  | How screens are put together                                        |
| `@sincpro/criteria`      | How a screen asks the server for records                            |
| `@sincpro/web-framework` | What a record holds: reading, editing and acting on it, by its meta |
| Your application         | What a record is                                                    |

## Development

```bash
nvm use       # Node 26, from .nvmrc
make init     # pre-commit + yarn install
make test
make build
```

Every operation — local or CI — goes through the `Makefile`; run `make` to list the targets.

```text
src/      the published source (imports itself as @sincpro/web-framework)
tests/    node --test over the TypeScript sources
```

## CI/CD

The workflows in `.github/workflows/` only delegate to the shared `Sincpro-SRL/.github`
pipeline, which calls `make init`, `make verify-format`, `make test`,
`make update-version VERSION=x` and `make publish`.
