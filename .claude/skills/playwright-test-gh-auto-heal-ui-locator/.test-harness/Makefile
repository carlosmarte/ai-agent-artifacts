# Test harness for the playwright-ui-locator skill.
#
#   make build     build the skill's TS package (prereq for both tiers)
#   make fixtures  deterministic tier — fast, no API key, the regression gate
#   make claude    agentic tier — drives the real skill via the Claude Agent SDK
#   make all       build + fixtures (+ claude if ANTHROPIC_API_KEY is set)
#   make clean     remove metrics/ output and harness node_modules

HERE       := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
SKILL_ROOT := $(abspath $(HERE)/..)

.PHONY: all build fixtures claude claude-install clean

all: build fixtures
	@if [ -n "$$ANTHROPIC_API_KEY" ]; then $(MAKE) claude; else \
	  echo "[harness] ANTHROPIC_API_KEY unset — skipping agentic tier (run 'make claude' after exporting it)"; fi

build:
	cd "$(SKILL_ROOT)" && ./setup.sh

fixtures:
	node "$(HERE)/run-fixtures.mjs"

claude-install:
	cd "$(HERE)/claude" && npm install

claude:
	@cd "$(HERE)/claude" && [ -d node_modules ] || npm install
	node "$(HERE)/claude/run-skill.mjs"

clean:
	rm -rf "$(HERE)/metrics" "$(HERE)/claude/node_modules" "$(HERE)/claude/package-lock.json"
