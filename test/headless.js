// headless.js
// ------------------------------------------------------------
// Node driver for knights_spiral.js. Runs the simulation to
// completion in LUDICROUS mode (no animation), then writes the
// final board as a PNG.
//
// CLI:
//   node headless.js --out=path.png \
//                    [--pieces=knight,knight] \
//                    [--start=0,1] \
//                    [--colors=BLACK,RED] \
//                    [--size=2001] \
//                    [--moves=N]
//
// Output PNG dimensions are side x side, 1 cell = 1 pixel
// (truest representation of pixel mode).

"use strict";

var fs   = require("fs");
var path = require("path");
var nc   = require("canvas");

// ----- parse CLI -----
function parseArgs(argv) {
    var out = { out: null, pieces: null, start: null, colors: null,
                size: null, moves: null };
    for (var i = 0; i < argv.length; i++) {
        var a = argv[i];
        var eq = a.indexOf("=");
        if (a.slice(0, 2) !== "--" || eq < 0) {
            throw new Error("bad arg: " + a + " (expected --key=value)");
        }
        var k = a.slice(2, eq);
        var v = a.slice(eq + 1);
        if (!(k in out)) throw new Error("unknown arg: " + k);
        out[k] = v;
    }
    if (!out.out) throw new Error("missing required --out=path.png");
    return out;
}

// Build a fake URL query string for parse_url_config to read.
function buildQueryString(args) {
    var parts = [];
    if (args.pieces) parts.push("pieces=" + encodeURIComponent(args.pieces));
    if (args.start)  parts.push("start="  + encodeURIComponent(args.start));
    if (args.colors) parts.push("colors=" + encodeURIComponent(args.colors));
    if (args.size)   parts.push("size="   + encodeURIComponent(args.size));
    if (args.moves)  parts.push("moves="  + encodeURIComponent(args.moves));
    return parts.length ? "?" + parts.join("&") : "";
}

var args = parseArgs(process.argv.slice(2));

// Final canvas size: one pixel per board cell, sized to the
// requested ?size= (post-rounding to next odd). Default 2001.
var sz = parseInt(args.size || "2001", 10);
if (isNaN(sz) || sz < 5) sz = 2001;
if ((sz & 1) === 0) sz += 1;
if (sz > 2001) sz = 2001;
var CANVAS_PX = sz;

// ----- install browser-shim globals BEFORE loading the game -----
var mainCanvas = nc.createCanvas(CANVAS_PX, CANVAS_PX);

global.window = {
    innerWidth:  CANVAS_PX,
    innerHeight: CANVAS_PX,
    location:    { search: buildQueryString(args) },
    requestAnimationFrame: function() { /* no-op: we drive manually */ }
};

global.document = {
    getElementById: function(id) {
        if (id === "board") return mainCanvas;
        return null;  // speed_btn / dump_btn / save_img_btn etc.
    },
    createElement: function(tag) {
        if (tag === "canvas") {
            // Offscreen pixel snapshot creates these.
            return nc.createCanvas(1, 1);
        }
        // Anchor tags etc. used only by download paths we never call.
        return { style: {}, click: function(){}, setAttribute: function(){} };
    },
    body: {
        appendChild: function() {},
        removeChild: function() {}
    },
    documentElement: { clientWidth: CANVAS_PX, clientHeight: CANVAS_PX }
};

global.Image = nc.Image;

global.performance = { now: function() { return Date.now(); } };

// URL.createObjectURL / Blob are only used by download_sequences /
// save_image, neither of which the headless driver calls.

// ----- load the game (defines global knights_spiral) -----
// knights_spiral.js does "var knights_spiral = {...};" at top level.
// In Node, indirect eval evaluates in the global scope but `var` in
// strict-ish module wrappers can still bind locally. To be safe we
// append a line that publishes the variable onto `global`, then eval.
var gameSrc = fs.readFileSync(
    path.join(__dirname, "..", "knights_spiral.js"), "utf8");
gameSrc += "\n;global.knights_spiral = knights_spiral;\n";
(0, eval)(gameSrc);
var ks = global.knights_spiral;
if (!ks) throw new Error("failed to load knights_spiral global");

// ----- start: wires canvas, parses URL, builds initial state -----
ks.start();
// start() also requestAnimationFrame'd a frame, which our stub ate.

// ----- engage LUDICROUS: slow -> fast -> superfast -> light -> ludicrous -----
for (var i = 0; i < 4; i++) ks.toggle_speed();
if (ks.speed_mode !== "ludicrous") {
    throw new Error("expected ludicrous, got " + ks.speed_mode);
}

// ----- drive the run to terminal synchronously -----
// Mirrors the body of the pixel-mode branch in frame(), with no
// time budget and no requestAnimationFrame.
function runUntilTerminal(ks) {
    var max_iters = 50 * 1000 * 1000;  // sanity cap
    var iter = 0;
    while (iter++ < max_iters) {
        if (ks.phase === "capped" ||
            ks.phase === "moves_limit" ||
            ks.phase === "deadlock") return;

        // Moves limit check.
        if (ks.max_moves !== null && ks.moves_done >= ks.max_moves) {
            ks.phase = "moves_limit";
            return;
        }

        // Apply queued move from previous iteration.
        if (ks.move_to) {
            ks.finish_move();
            ks.move_to = null;
            if (!ks.plan_move(ks.turn)) {
                ks.phase = "capped";
                return;
            }
        }

        var move = ks.plan_move(ks.turn);
        if (!move) {
            // Could be deadlock vs cap. Distinguish: if any spiral
            // index within MAX_HALF would be legal we don't get here.
            // Treat as capped (same behavior as the frame loop's
            // pixel-mode branch).
            ks.phase = "capped";
            return;
        }

        var need = Math.max(
            ks.required_half(),
            Math.abs(move.x),
            Math.abs(move.y)
        );
        if (need > ks.half) {
            if (need > ks.MAX_HALF) {
                ks.phase = "capped";
                return;
            }
            ks.layout(need);
            ks.pixel_layout();
            if (ks._pixel_off_ensure) ks._pixel_off_ensure();
        }

        ks.start_move_instant(move);
        ks.finish_move();
        ks.move_to = null;
    }
    throw new Error("runUntilTerminal hit sanity cap of " + max_iters);
}

console.log("[headless] config:",
    "pieces=" + (args.pieces || "knight,knight"),
    "start=" + (args.start || "0,1"),
    "colors=" + (args.colors || "(default)"),
    "size=" + sz);
console.log("[headless] running...");
var t0 = Date.now();
runUntilTerminal(ks);
var elapsed = ((Date.now() - t0) / 1000).toFixed(2);
console.log("[headless] terminal phase=" + ks.phase,
    "moves=" + ks.moves_done,
    "board=" + ks.side + "x" + ks.side,
    "elapsed=" + elapsed + "s");

// ----- resize the main canvas to side x side (1 cell = 1 pixel) -----
// We do this AFTER the run so layout()/pixel_layout() during the run
// use a stable big canvas. Now switch the visible canvas to the
// final board side and draw the pixel board onto it.
mainCanvas.width  = ks.side;
mainCanvas.height = ks.side;
ks.W = ks.side;
ks.H = ks.side;
ks.canvas = mainCanvas;
ks.ctx    = mainCanvas.getContext("2d");
ks.pixel_layout();

// Export the logical side×side pixel board (matches save_image()).
ks._pixel_off_ensure();
var exportCanvas = ks._pixel_off;
if (!exportCanvas || ks._pixel_off_half !== ks.half) {
    throw new Error("pixel offscreen missing at terminal");
}

// ----- write PNG -----
var outDir = path.dirname(args.out);
if (outDir && !fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(args.out, exportCanvas.toBuffer("image/png"));
console.log("[headless] wrote " + args.out +
    " (" + ks.side + "x" + ks.side + ")");
