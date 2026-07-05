# Assay — the spending brain for research agents
# One-command developer ergonomics. `make help` lists everything.

PY  := ./.venv/bin/python
PIP := ./.venv/bin/pip

.DEFAULT_GOAL := help

.PHONY: help install install-backend install-web install-agent \
        backend web seed run test clean-db reset stop demo

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: install-backend install-web install-agent ## Install all deps (backend, web, agent)

install-backend: ## npm install for the backend
	cd backend && npm install

install-web: ## npm install for the web app
	cd web && npm install

install-agent: ## Install Python agent deps into .venv
	$(PIP) install -r agent/requirements.txt

backend: ## Run the backend registry/ledger API on :4000
	cd backend && npm run start

web: ## Run the Next.js demo surface on :3000
	cd web && npm run dev

seed: ## Seed creators + sources + run the demo task batch (mock pay flag on)
	ASSAY_MOCK_PAY=1 $(PY) scripts/seed.py --run

run: ## Run a single research task from the CLI (usage: make run Q="..." B=0.01)
	$(PY) agent/cli.py "$(Q)" --budget $(or $(B),0.01)

test: ## Run the zero-dependency engine test suite
	$(PY) agent/run_tests.py

clean-db: ## Wipe the SQLite ledger (fresh, pristine demo metrics)
	rm -f backend/data/assay.sqlite backend/data/assay.sqlite-shm backend/data/assay.sqlite-wal
	@echo "ledger wiped"

reset: clean-db ## Wipe the ledger, then re-seed a clean batch
	$(MAKE) seed

stop: ## Kill anything holding ports 4000 / 3000
	-lsof -ti:4000 | xargs kill -9 2>/dev/null || true
	-lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@echo "stopped :4000 and :3000"

demo: ## Full local demo: fresh ledger, seeded batch, backend + web up
	@echo "1) wiping ledger & seeding a clean batch..."
	$(MAKE) reset
	@echo "2) open http://localhost:3000 (run 'make backend' and 'make web' in two terminals)"
