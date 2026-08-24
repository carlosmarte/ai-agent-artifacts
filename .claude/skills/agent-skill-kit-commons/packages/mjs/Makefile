# .agents/skills/agent-skill-kit-commons/packages/mjs — CI Makefile
#
# Thin wrapper around npm + node 20 ESM tooling for local + CI parity.
# Every target is idempotent and safe to re-run. `make ci` is the single
# command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
NPM            ?= npm
NODE           ?= node
SUITE_ROOT     := $(shell git rev-parse --show-toplevel)/.agents/skills

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir : $(PKG_DIR)"
	@echo "suite   : $(SUITE_ROOT)"
	@$(NODE) --version
	@$(NPM) --version

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies (mutable lockfile OK)
	$(NPM) install

.PHONY: ci-install
ci-install: ## Deterministic install for CI (frozen lockfile)
	$(NPM) ci

.PHONY: test
test: ## Run vitest suite
	$(NPM) test

.PHONY: lint
lint: ## ESLint flat config
	$(NPM) run lint

.PHONY: build
build: ## Produce ./dist/
	@rm -rf dist
	$(NPM) run build

.PHONY: clean
clean: ## Remove generated artifacts
	@rm -rf dist coverage

.PHONY: distclean
distclean: clean ## Also remove node_modules
	@rm -rf node_modules

# ---------------------------------------------------------------------------
# CI aggregate (runs the suite gates after the lifecycle pipeline)
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline (install → lint → test → build → suite gates)
	$(NPM) exec -- skills-ref validate $(SUITE_ROOT) --extra-tiers company,enterprise,application
	$(NPM) exec -- skills-ref lint     $(SUITE_ROOT)
	$(NPM) exec -- skills-ref audit    $(SUITE_ROOT)
	$(NPM) exec -- skills-ref deps     $(SUITE_ROOT) --extra-tiers company,enterprise,application
