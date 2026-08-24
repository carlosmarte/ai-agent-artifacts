# .agents/skills/agent-skill-kit-commons/packages/py — CI Makefile
#
# Thin wrapper around uv + pytest + ruff for local + CI parity.
# Every target is idempotent and safe to re-run. `make ci` is the single
# command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
UV             ?= uv
PY             ?= python
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
	@$(UV) --version
	@$(UV) run -- $(PY) --version

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies (mutable lockfile OK)
	$(UV) sync

.PHONY: ci-install
ci-install: ## Deterministic install for CI (frozen lockfile)
	$(UV) sync --frozen

.PHONY: test
test: ## Run pytest
	$(UV) run -- pytest -v

.PHONY: lint
lint: ## Ruff
	$(UV) run -- ruff check .

.PHONY: build
build: ## Produce ./dist/ (wheel only — sdist excludes the symlinked assets dir, wheel force-includes the real files)
	@rm -rf dist
	$(UV) build --wheel

.PHONY: clean
clean: ## Remove generated artifacts
	@rm -rf dist .pytest_cache __pycache__
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

.PHONY: distclean
distclean: clean ## Also remove .venv
	@rm -rf .venv

# ---------------------------------------------------------------------------
# CI aggregate (runs the suite gates after the lifecycle pipeline)
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline (install → lint → test → build → suite gates)
	$(UV) run -- skills-ref validate $(SUITE_ROOT) --extra-tiers company,enterprise,application
	$(UV) run -- skills-ref lint     $(SUITE_ROOT)
	$(UV) run -- skills-ref audit    $(SUITE_ROOT)
	$(UV) run -- skills-ref deps     $(SUITE_ROOT) --extra-tiers company,enterprise,application
