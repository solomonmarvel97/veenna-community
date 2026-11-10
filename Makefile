# Veenna Community - run `make` or `make help`. Everything goes through bun.
.DEFAULT_GOAL := help
.PHONY: help install dev web mac mac-unsigned windows linux test test-api lint typecheck check api-keys api-build api clean

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	bun install

dev: ## Run the desktop app (Vite on :3021 + Electron)
	bun run electron:dev

web: ## Run the renderer alone in a browser (Vite on :3021)
	bun run dev

mac: ## Build the macOS installer, signed and notarised (needs Apple credentials)
	bun run electron:build

mac-unsigned: ## Build the macOS installer, ad-hoc signed (local use)
	bun run electron:build:unsigned

windows: ## Build the Windows installer
	bun run electron:build:win

linux: ## Build the Linux packages (.deb, .AppImage, .tar.gz); run on Linux
	bun run electron:build:linux

test: ## Renderer unit tests + main-process tests
	bun run test:unit
	bun run test:electron

test-api: ## Community API tests
	bun run test:api

lint: ## Lint
	bun run lint

typecheck: ## Type-check
	bun run typecheck

check: typecheck lint test test-api ## Everything CI would run

api-keys: ## Make a dev signing key for the local API (once)
	cd api && bun run keygen dev

api-build: ## Write the signed catalog files into api/dist/v1
	cd api && bun run build

api: api-build ## Serve the local API on :8787 (start the app with VEENNA_COMMUNITY_API=http://localhost:8787/v1)
	cd api && bun run start

clean: ## Remove build output (dist, release)
	rm -rf dist release
