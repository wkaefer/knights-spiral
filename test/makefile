# ============================================================
# 🌀 KNIGHTS SPIRAL -- headless test image generator
# ============================================================
#
# Targets ARE the output PNG files. Each runs headless.js with a
# fixed configuration so renders are reproducible.
#
# Usage:
#   make help                              -- list targets
#   make all                               -- build every test image
#   make images/knight2-black-red-2001.png -- build one image
#   make clean                             -- remove all images
#
# ------------------------------------------------------------

OUT    := images
NODE   := node
DRIVER := headless.js
DEPS   := $(DRIVER) ../knights_spiral.js node_modules/.installed

# Canonical board PNG (side×side pixel board, no viewport/plaid).
# Default knight,knight @ size 2001 after 3900475 moves.
MD5_KNIGHT2_DEFAULT_2001 := 1c21bcb66180a7c8fa8b1757bee651c1

.PHONY: all clean help

help:
	@echo "Knights Spiral -- test image targets"
	@echo ""
	@echo "  make all     -- build every image"
	@echo "  make clean   -- remove generated images"
	@echo ""
	@echo "  individual images:"
	@grep -E '^\$$\(OUT\)/[A-Za-z0-9._-]+\.png:' makefile \
	    | sed -E 's|\$$\(OUT\)|$(OUT)|; s|:.*||; s|^|    make |'

# ============================================================
# 🛠️  HOUSEKEEPING TARGETS
# ============================================================

#
# all - Build every test image
# ----------------------------
all: $(OUT)/knight2-black-red-2001.png        \
     $(OUT)/knight2-default-2001.png          \
     $(OUT)/knight2-default-1001.png          \
     $(OUT)/knight3-trio-2001.png             \
     $(OUT)/knight4-quad-2001.png             \
     $(OUT)/knight5-penta-2001.png            \
     $(OUT)/knight6-hex-2001.png              \
     $(OUT)/knight7-sept-2001.png             \
     $(OUT)/knight-antelope-black-green-2001.png \
     $(OUT)/rook2-blue-green-101.png          \
     $(OUT)/bishop-knight-rook-101.png

#
# clean - Remove all generated images
# -----------------------------------
clean:
	rm -f $(OUT)/*.png

#
# $(OUT) - Ensure the images output directory exists
# --------------------------------------------------
$(OUT):
	mkdir -p $(OUT)

#
# node_modules/.installed - Install npm dependencies (canvas)
# -----------------------------------------------------------
node_modules/.installed: package.json
	npm install
	@touch $@

# ============================================================
# 🖼️  IMAGE TARGETS  (one rule per PNG)
# ============================================================

#
# knight2-black-red-2001.png - Issue-1 reproducer URL
# ---------------------------------------------------
$(OUT)/knight2-black-red-2001.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=knight,knight --start=0,1 \
	    --colors=BLACK,RED --size=2001

#
# knight2-default-2001.png - Default stranded mode, size 2001 (golden)
# --------------------------------------------------------------------
$(OUT)/knight2-default-2001.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=knight,knight --start=0,1 --size=2001
	@echo $(MD5_KNIGHT2_DEFAULT_2001)  $@ | md5sum -c -

#
# knight2-default-1001.png - Default stranded mode, size 1001
# -----------------------------------------------------------
$(OUT)/knight2-default-1001.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=knight,knight --start=0,1 --size=1001

#
# knight3-trio-2001.png - Three knights starting at 0/1/2
# -------------------------------------------------------
$(OUT)/knight3-trio-2001.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=knight,knight,knight --start=0,1,2 --size=2001

#
# rook2-blue-green-101.png - Pure slider configuration (slow path)
# ----------------------------------------------------------------
# Note: 2-rook setup uses per-call attacked_set() rebuild which is
# O(painted * side) per move. Size kept small to bound runtime.
$(OUT)/rook2-blue-green-101.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=rook,rook --start=0,1 \
	    --colors=BLUE,GREEN --size=101

#
# bishop-knight-rook-101.png - Mixed pieces (slow path)
# -----------------------------------------------------
# Any non-jumper piece forces the slow per-call attack rebuild.
# Kept at 101 for the same reason as rook2.
$(OUT)/bishop-knight-rook-101.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=bishop,knight,rook --start=0,1,2 --size=101

#
# knight4-quad-2001.png - Four knights starting at 0/1/2/3
# ---------------------------------------------------------
$(OUT)/knight4-quad-2001.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=knight,knight,knight,knight --start=0,1,2,3 --size=2001

#
# knight5-penta-2001.png - Five knights starting at 0/1/2/3/4
# ------------------------------------------------------------
$(OUT)/knight5-penta-2001.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=knight,knight,knight,knight,knight --start=0,1,2,3,4 --size=2001

#
# knight6-hex-2001.png - Six knights starting at 0/1/2/3/4/5
# -----------------------------------------------------------
$(OUT)/knight6-hex-2001.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=knight,knight,knight,knight,knight,knight --start=0,1,2,3,4,5 --size=2001

#
# knight7-sept-2001.png - Seven knights starting at 0/1/2/3/4/5/6
# ----------------------------------------------------------------
$(OUT)/knight7-sept-2001.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=knight,knight,knight,knight,knight,knight,knight \
	    --start=0,1,2,3,4,5,6 --size=2001

#
# knight-antelope-black-green-2001.png - Knight + Antelope, Black and Green
# --------------------------------------------------------------------------
$(OUT)/knight-antelope-black-green-2001.png: $(DEPS) | $(OUT)
	$(NODE) $(DRIVER) --out=$@ \
	    --pieces=knight,antelope --start=0,1 \
	    --colors=BLACK,GREEN --size=2001
