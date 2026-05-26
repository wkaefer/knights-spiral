# ============================================================
# 🌀 KNIGHTS SPIRAL -- repo-level targets
# ============================================================
#
# The browser game is zero-build: open knights_spiral.html in a
# browser to run it. This makefile only handles repo plumbing
# (GitHub remote, snapshot push) and a pass-through to the
# headless test harness under test/.
#
# Usage:
#   make help         -- list targets
#   make test         -- build every test image (delegates to test/)
#   make jwk          -- add GitHub remote (run once)
#   make github-push  -- push orphan snapshot to GitHub main
#
# ------------------------------------------------------------

.PHONY: help test jwk github-push

help:
	@echo "Knights Spiral -- repo targets"
	@echo ""
	@echo "  make test         -- build every test image (cd test && make all)"
	@echo "  make jwk          -- add GitHub remote (run once)"
	@echo "  make github-push  -- push orphan snapshot to GitHub main"
	@echo ""
	@echo "For test-image targets, see: make -C test help"

# ============================================================
# 🧪 TEST HARNESS PASS-THROUGH
# ============================================================

#
# test - Delegate to the headless test harness in test/
# -----------------------------------------------------
test:
	$(MAKE) -C test all

# 🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵 jwk 🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵🌵

#
# jwk - Add GitHub remote (run once)
# ----------------------------------
jwk:
	git remote add github git@github.com:wkaefer/knights-spiral.git

# 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 github 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀

#
# github-push - Push orphan snapshot to GitHub main
# -------------------------------------------------
github-push:
	git checkout --orphan github-staging
	git commit -m "Snapshot: $$(date +%Y-%m-%d)"
	git push --force github github-staging:main
	git checkout main
	git branch -D github-staging
