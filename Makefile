.DEFAULT_GOAL := help

PACKAGE := @sincpro/web-framework

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  prepare-environment  pre-commit + yarn"
	@echo "  install         yarn install"
	@echo "  init            prepare-environment + install"
	@echo "  format          eslint --fix + prettier, then typecheck"
	@echo "  lint            eslint"
	@echo "  typecheck       tsc --noEmit"
	@echo "  doctor          the traps tsc does not catch"
	@echo "  test            vitest: the logic in Node + every use case (story + play) in Chrome"
	@echo "  verify-format   format + lint + doctor, then fail if the tree is dirty (CI)"
	@echo "  build           compile into dist/"
	@echo "  dev             Storybook on :6008 — the use cases"
	@echo "  storybook       static Storybook into storybook-static/"
	@echo "  update-version  VERSION=x.y.z — release pipeline only, never by hand"
	@echo "  publish         build + publish to NPM (release pipeline)"
	@echo "  clean           remove dist/, storybook-static/ and node_modules/"

prepare-environment:
	@pipx install pre-commit
	@pipx ensurepath
	@pre-commit install
	@command -v yarn > /dev/null || npm install -g yarn

install:
	@echo "Installing Node.js dependencies..."
	@yarn install

init: prepare-environment install

typecheck:
	@npx tsc --noEmit

format:
	@echo "🔤 Sorting imports + auto-fix (eslint)..."
	@npx eslint . --fix
	@echo "🎨 Formatting (prettier)..."
	@npx prettier --experimental-cli --write "**/*.{ts,tsx,css,json,md}" ".github/**/*.{yaml,yml}" --ignore-path .prettierignore --ignore-unknown
	@echo "Checking types after formatting..."
	@$(MAKE) typecheck

lint:
	@npx eslint .

# The traps `tsc` does not catch. Comment lines are skipped: an example inside a docstring is
# documentation, not an import.
SCAN := grep -rnE --include=*.ts --include=*.tsx
NOT_COMMENT := grep -vE ':[0-9]+: *(\*|//|/\*)'

doctor:
	@echo "🩺 Checking the traps..."
	@found=0; \
	if $(SCAN) 'from "\.' src | $(NOT_COMMENT); then \
		echo >&2 "✘ relative import — the source imports itself as $(PACKAGE)"; found=1; \
	fi; \
	if $(SCAN) 'from "[^"]+\.tsx?"' src | $(NOT_COMMENT); then \
		echo >&2 "✘ .ts/.tsx extension in an import — the build emits it as-is and breaks"; found=1; \
	fi; \
	if $(SCAN) 'from "(react|react-dom|@sincpro/web-ui|@sincpro/criteria-react)["/]|from "$(PACKAGE)/(react|web)/' src/core | $(NOT_COMMENT); then \
		echo >&2 "✘ core/ importing React, the DOM or a UI — core/ is plain logic, tested in Node"; found=1; \
	fi; \
	if $(SCAN) 'from "(react-dom|@sincpro/web-ui)["/]|from "$(PACKAGE)/web/' src/react | $(NOT_COMMENT); then \
		echo >&2 "✘ react/ importing the DOM or web-ui — react/ holds state, web/ draws"; found=1; \
	fi; \
	if $(SCAN) 'from "@sincpro/web-composer' src/web/record | $(NOT_COMMENT); then \
		echo >&2 "✘ web/record/ importing the composer — a form works outside a workspace"; found=1; \
	fi; \
	if $(SCAN) '(^|[^.A-Za-z_])(document|window)\.' src/core src/react | $(NOT_COMMENT); then \
		echo >&2 "✘ document/window outside web/ — only web/ may touch the DOM"; found=1; \
	fi; \
	if [ "$$found" = "1" ]; then exit 1; fi; \
	echo "✓ no traps found"

# One runner, two projects (vitest.config.ts): `model` in Node, `storybook` in a real Chrome —
# the stories ARE the tests, and Storybook's «Run tests» runs these same ones.
test:
	@echo "🧪 Running tests..."
	@VITE_CONFIG_NATIVE_IGNORE_WARNING=true npx vitest run

verify-format: format lint doctor
	@if ! git diff --quiet; then \
	  echo >&2 "✘ Formatting changed files. Please add them to the commit."; \
	  git --no-pager diff --name-only HEAD -- >&2; \
	  exit 1; \
	fi
	@echo "✓ Format verification passed"

build:
	@echo "🏗️  Building $(PACKAGE) -> dist (tsc)..."
	@rm -rf dist
	@npx tsc -p tsconfig.build.json
	@npx tsc-alias -p tsconfig.build.json
	@echo "✓ Build ready in ./dist (JS + .d.ts, $(PACKAGE) resolved to relative)"

dev:
	@npx storybook dev -p 6008 --no-open

storybook:
	@npx storybook build -o storybook-static

# `--package-lock=false`: npm (unlike yarn, which manages this repo's installs) doesn't read
# yarn.lock, so without it `npm version` rebuilds a dependency tree against the real registry
# and writes a package-lock.json this repo doesn't keep.
update-version:
ifndef VERSION
	$(error VERSION is required. Usage: make update-version VERSION=1.2.3)
endif
	@CURRENT_VERSION=$$(node -p "require('./package.json').version"); \
	if [ "$$CURRENT_VERSION" = "$(VERSION)" ]; then \
		echo "✓ Version is already $(VERSION), skipping update"; \
	else \
		npm version $(VERSION) --no-git-tag-version --package-lock=false && \
			echo "✓ Version updated to $(VERSION)"; \
	fi

publish: build
	@echo "📦 Publishing $(PACKAGE) to NPM..."
	@if [ -n "$$NPM_TOKEN" ]; then \
		echo "//registry.npmjs.org/:_authToken=$$NPM_TOKEN" > .npmrc.tmp; \
		chmod 600 .npmrc.tmp; \
		npm publish --access public --userconfig .npmrc.tmp; \
		rm -f .npmrc.tmp; \
	else \
		npm publish --access public; \
	fi
	@echo "✓ Published successfully"

deploy:
	@echo "Deploy not applicable for library packages"

clean:
	@rm -rf dist storybook-static node_modules
	@echo "✓ Cleaned"

.PHONY: help prepare-environment install init typecheck format lint doctor test verify-format build \
	dev storybook update-version publish deploy clean
