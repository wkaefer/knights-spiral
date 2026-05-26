// Knights Spiral
// ------------------------------------------------------------
// A spiral-board painting game derived from Knights Games.
//
// Up to 7 pieces of different types (knight, rook, bishop,
// camel, zebra, giraffe, antelope) take alternating turns on
// a spiral-numbered expanding board.
//
// Configuration via URL query string:
//   ?pieces=knight,rook,bishop&start=0,1,2&colors=green,black,red
//
//   colors= is optional. Names are case-insensitive and must match the
//   palette: BLACK, RED, BLUE, GREEN, PURPLE, ORANGE, TEAL.
//   Count must equal the pieces count; duplicates are not allowed.
//   Defaults to palette order when omitted.
//
// Rules (different from knights_games):
//   - On its turn, a piece walks spiral indices 0,1,2,... and
//     picks the LOWEST one that is:
//       (a) not occupied,
//       (b) not painted,
//       (c) not attackable by any square painted by a DIFFERENT
//           color, using that color's piece type as the attack
//           pattern.
//   - The piece teleports to that square and paints it its color.
//   - Sliders (rook/bishop) attack along rays, blocked by any
//     painted or occupied square (standard line-of-sight).
//   - Jumpers (knight, camel, zebra, giraffe, antelope) attack
//     their fixed L-offsets.
//   - The board grows outward as needed (max half 1000 -> 2001x2001).
//   - After PIXEL_THRESHOLD moves, the next board grow switches
//     to pixel mode: 1 cell = 1 canvas pixel.
//   - Deadlock (no legal square anywhere) or board cap shows a
//     terminal banner and stops.
//
// Spiral numbering (0 at center, 1 east, then CCW outward):
//
//   16 15 14 13 12  .
//   17  4  3  2 11  .
//   18  5  0  1 10  .
//   19  6  7  8  9 26
//   20 21 22 23 24 25

"use strict";

var knights_spiral = {

    // ---- board colors ----
    LIGHT      : "#f0d9b5",
    DARK       : "#b58863",
    FRAME      : "#3a2412",
    FELT       : "#0a8a4a",
    GLYPH_HALO : "#f8f4ec",

    NUM_LIGHT  : "#6a5a3a",
    NUM_DARK   : "#3a2810",

    // ---- 7-piece palette (glyph color, tint, num-on-paint color) ----
    PALETTE : [
        { name:"BLACK",  glyph:"#111111", tint:"rgba(20,20,20,0.62)",    num:"#f0e4c8" },
        { name:"RED",    glyph:"#b40020", tint:"rgba(180,0,32,0.62)",    num:"#f8e8d0" },
        { name:"BLUE",   glyph:"#1a52c8", tint:"rgba(26,82,200,0.62)",   num:"#d8e8ff" },
        { name:"GREEN",  glyph:"#1c8a3a", tint:"rgba(28,138,58,0.62)",   num:"#d0f0d8" },
        { name:"PURPLE", glyph:"#7a2bb8", tint:"rgba(122,43,184,0.62)",  num:"#ead8ff" },
        { name:"ORANGE", glyph:"#d8732a", tint:"rgba(216,115,42,0.62)",  num:"#ffe8c8" },
        { name:"TEAL",   glyph:"#1c8a8a", tint:"rgba(28,138,138,0.62)", num:"#c8f0f0" }
    ],

    // Pixel-mode solid colors (one per palette entry)
    PIXEL_COLORS : [
        "#333333",  // BLACK
        "#cc1122",  // RED
        "#2255dd",  // BLUE
        "#22aa44",  // GREEN
        "#8833cc",  // PURPLE
        "#dd8833",  // ORANGE
        "#22aaaa"   // TEAL
    ],

    // ---- piece type registry ----
    // kind:"jumper" -- offsets are [dx,dy] absolute L-jumps.
    // kind:"slider" -- rays is array of [dx,dy] unit direction vectors;
    //                  walk until painted/occupied/off-board.
    PIECE_TYPES : {
        knight : {
            kind    : "jumper",
            glyph   : "\u265E",  // ♞
            offsets : [[ 2, 1],[ 1, 2],[-1, 2],[-2, 1],
                       [-2,-1],[-1,-2],[ 1,-2],[ 2,-1]]
        },
        rook : {
            kind : "slider",
            glyph: "\u265C",   // ♜
            rays : [[ 1, 0],[-1, 0],[ 0, 1],[ 0,-1]]
        },
        bishop : {
            kind : "slider",
            glyph: "\u265D",   // ♝
            rays : [[ 1, 1],[ 1,-1],[-1, 1],[-1,-1]]
        },
        camel : {
            kind    : "jumper",
            glyph   : "\u265E",  // ♞ (3,1)-leaper
            offsets : [[ 3, 1],[ 1, 3],[-1, 3],[-3, 1],
                       [-3,-1],[-1,-3],[ 1,-3],[ 3,-1]]
        },
        zebra : {
            kind    : "jumper",
            glyph   : "\u265E",  // ♞ (3,2)-leaper
            offsets : [[ 3, 2],[ 2, 3],[-2, 3],[-3, 2],
                       [-3,-2],[-2,-3],[ 2,-3],[ 3,-2]]
        },
        giraffe : {
            kind    : "jumper",
            glyph   : "\u265E",  // ♞ (4,1)-leaper
            offsets : [[ 4, 1],[ 1, 4],[-1, 4],[-4, 1],
                       [-4,-1],[-1,-4],[ 1,-4],[ 4,-1]]
        },
        antelope : {
            kind    : "jumper",
            glyph   : "\u265E",  // ♞ (4,3)-leaper
            offsets : [[ 4, 3],[ 3, 4],[-3, 4],[-4, 3],
                       [-4,-3],[-3,-4],[ 3,-4],[ 4,-3]]
        }
    },

    // ---- timing ----
    LUDICROUS_MOVE_MS : 1,
    LUDICROUS_GROW_MS : 2,
    LIGHT_MOVE_MS     : 1,
    LIGHT_GROW_MS     : 2,
    SUPERFAST_MOVE_MS : 8,
    SUPERFAST_GROW_MS : 16,
    FAST_MOVE_MS : 40,
    FAST_GROW_MS : 80,
    SLOW_MOVE_MS : 380,
    SLOW_GROW_MS : 400,
    MOVE_MS      : 380,
    GROW_MS      : 400,

    // After this many moves, stop drawing per-cell spiral numbers.
    NUMBERS_MAX : 1024,
    // After this many moves, stop drawing the text readout.
    READOUT_MAX : 512,
    // After this many moves per piece, stop appending to its
    // sequence array (memory/perf -- old entries are kept).
    SEQUENCE_MAX : 5000,
    // Max board half before we stop. Hard cap: 2001x2001 board
    // (half=1000). Sized large enough to cover the full plaid
    // background in LUDICROUS mode while still bounding the run.
    MAX_HALF    : 1000,
    // Absolute upper bound on configured board side (?size= param).
    // Kept odd so the board has a center cell.
    SIZE_CAP    : 2001,
    // Pixel mode threshold: post-move-3000 grow triggers pixel mode
    // if the sequence can continue.
    PIXEL_THRESHOLD : 2000,

    // ---- mutable speed state ----
    speed_mode : "slow",

    // ---- canvas / window ----
    canvas  : null,
    ctx     : null,
    W       : 0,
    H       : 0,

    // ---- board geometry ----
    half    : 0,
    side    : 0,
    cell    : 0,
    frame_w : 0,
    board_x : 0,
    board_y : 0,

    // ---- grow tween ----
    tween   : null,  // {start_ts, from_half, to_half}

    // ---- game state ----
    painted       : {},   // key(x,y) -> color_idx
    pieces        : null, // [{type, color_idx, x, y, sequence:[...]}]
    color_type    : null, // [type_string] indexed by color_idx
    turn          : 0,
    moves_done    : 0,

    // ---- ludicrous-mode incremental caches ----
    // _attacker_mask[key] = bitmask of color indices attacking that square.
    // _all_jumpers       = true iff every piece type is a jumper (no sliders).
    // _ludicrous_ready   = true once caches are built and being maintained.
    // _pixel_off         = offscreen canvas snapshot of painted cells (pixel mode).
    // _pixel_off_ctx     = its 2d context.
    // _pixel_off_half    = the board half captured in _pixel_off (rebuilt on grow).
    _attacker_mask   : null,
    _all_jumpers     : false,
    _ludicrous_ready : false,
    _pixel_off       : null,
    _pixel_off_ctx   : null,
    _pixel_off_half  : -1,
    _max_extent      : 0,    // running max(|x|,|y|) over pieces + painted

    // Flat typed-array grids (ludicrous fast path).
    // Indexed by (y + _grid_half) * _grid_side + (x + _grid_half).
    _grid_painted : null,   // Uint8Array: 0 empty, else color_idx + 1
    _grid_mask    : null,   // Uint8Array: bitmask of attackers per square
    _grid_half    : -1,
    _grid_side    : 0,

    // Per-color spiral cursor (ludicrous fast path).
    // _search_from[color_idx] = lowest spiral index that has NOT yet
    // been permanently disqualified for this color. Valid only in
    // all-jumpers mode where painted and attacker bits are monotonic.
    _search_from  : null,

    // ---- animation phase ----
    // "idle" | "growing" | "moving" | "deadlock" | "capped" | "pixel"
    phase         : "idle",
    phase_ts      : 0,
    move_from     : null,
    move_to       : null,
    move_piece    : 0,
    _pending_move : null,

    // ---- terminal state ----
    deadlock_piece : -1,
    deadlock_cell  : null,

    // ---- pixel mode ----
    mode       : "chess",   // "chess" | "pixel"
    pixel_scale: 1,
    PIXEL_BUDGET_MS  : 12,  // ms of moves to compute per frame in pixel mode
    PIXEL_DRAW_EVERY : 1,   // offscreen blit keeps redraw cheap
    _pixel_frame_ctr : 0,

    // ---- plaid (LUDICROUS SPEED background) ----
    // gunn.gif (Gunn clan tartan) baked as a data URL so the canvas
    // is never tainted by a file:// fetch -- SAVE IMAGE keeps working.
    _plaid_img       : null,
    _plaid_pattern   : null,
    _plaid_loading   : false,
    GUNN_GIF_DATA_URL :
        "data:image/gif;base64,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",

    // ==========================================================
    // Entry points
    // ==========================================================

    start: function() {
        this.canvas = document.getElementById("board");
        this.ctx    = this.canvas.getContext("2d");
        this.resize_window();
        var cfg = this.parse_url_config();
        this.new_run(cfg);
        var self = this;
        window.requestAnimationFrame(function(t){ self.frame(t); });
    },

    resize: function() {
        this.resize_window();
        this.layout(this.half);
    },

    resize_window: function() {
        var w = window.innerWidth  || document.documentElement.clientWidth;
        var h = window.innerHeight || document.documentElement.clientHeight;
        this.canvas.width  = this.W = w;
        this.canvas.height = this.H = h;
    },

    // ==========================================================
    // URL config
    // ==========================================================

    parse_url_config: function() {
        var cfg = { types: ["knight","knight"], starts: null, max_moves: null };
        try {
            var qs = window.location.search.slice(1);
            if (!qs) return cfg;
            var params = {};
            qs.split("&").forEach(function(pair) {
                var kv = pair.split("=");
                params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
            });

            if (params.pieces) {
                var raw = params.pieces.split(",").map(function(s){ return s.trim().toLowerCase(); });
                // Clamp 1..7
                raw = raw.slice(0, 7);
                var valid = Object.keys(this.PIECE_TYPES);
                var types = raw.map(function(t) {
                    if (valid.indexOf(t) >= 0) return t;
                    console.warn("knights_spiral: unknown piece type '" + t + "', using knight");
                    return "knight";
                });
                if (types.length > 0) cfg.types = types;
            }

            if (params.start) {
                var starts = params.start.split(",").map(function(s){
                    var n = parseInt(s.trim(), 10);
                    return isNaN(n) ? 0 : n;
                });
                if (starts.length === cfg.types.length) cfg.starts = starts;
                else console.warn("knights_spiral: start count doesn't match piece count, using defaults");
            }

            if (params.colors) {
                var color_raw = params.colors.split(",").map(function(s){ return s.trim().toUpperCase(); });
                // Build name -> palette index map.
                var name_to_idx = {};
                for (var ci = 0; ci < this.PALETTE.length; ci++) {
                    name_to_idx[this.PALETTE[ci].name] = ci;
                }
                var colors_ok = true;
                if (color_raw.length !== cfg.types.length) {
                    console.warn("knights_spiral: colors count (" + color_raw.length +
                        ") doesn't match pieces count (" + cfg.types.length + "), ignoring colors=");
                    colors_ok = false;
                }
                if (colors_ok) {
                    for (var ci2 = 0; ci2 < color_raw.length; ci2++) {
                        if (!(color_raw[ci2] in name_to_idx)) {
                            console.warn("knights_spiral: unknown color '" + color_raw[ci2] +
                                "', ignoring colors=");
                            colors_ok = false;
                            break;
                        }
                    }
                }
                if (colors_ok) {
                    var seen_colors = {};
                    for (var ci3 = 0; ci3 < color_raw.length; ci3++) {
                        var cname = color_raw[ci3];
                        if (seen_colors[cname]) {
                            console.warn("knights_spiral: duplicate color '" + cname +
                                "', ignoring colors=");
                            colors_ok = false;
                            break;
                        }
                        seen_colors[cname] = true;
                    }
                }
                if (colors_ok) {
                    cfg.colors = color_raw.map(function(n){ return name_to_idx[n]; });
                }
            }

            if (params.moves) {
                var mv = parseInt(params.moves, 10);
                if (!isNaN(mv) && mv > 0) cfg.max_moves = mv;
            }

            if (params.size) {
                var sz = parseInt(params.size, 10);
                if (!isNaN(sz)) {
                    if (sz < 5)              sz = 5;
                    if (sz > this.SIZE_CAP)  sz = this.SIZE_CAP;
                    // Force odd so the board has a center cell.
                    // Round UP to the next odd so size=2000 -> 2001
                    // (user gets at least the size they asked for).
                    if ((sz & 1) === 0) sz += 1;
                    if (sz > this.SIZE_CAP)  sz = this.SIZE_CAP;  // re-clamp after +1
                    cfg.size = sz;
                }
            }
        } catch(e) { /* ignore parse errors */ }
        return cfg;
    },

    // ==========================================================
    // Run lifecycle
    // ==========================================================

    new_run: function(cfg) {
        this.painted    = {};
        this.pieces     = [];
        this.color_type = [];
        this.turn       = 0;
        this.moves_done = 0;
        this.tween      = null;
        this.mode       = "chess";
        this.phase      = "idle";
        this.phase_ts   = 0;
        this.deadlock_piece = -1;
        this.deadlock_cell  = null;
        this._pending_move  = null;
        this._attacker_mask   = null;
        this._all_jumpers     = false;
        this._ludicrous_ready = false;
        this._pixel_off       = null;
        this._pixel_off_ctx   = null;
        this._pixel_off_half  = -1;
        this._max_extent      = 0;
        this._grid_painted    = null;
        this._grid_mask       = null;
        this._grid_half       = -1;
        this._grid_side       = 0;
        this._search_from     = null;
        this.max_moves  = (cfg && cfg.max_moves != null) ? cfg.max_moves : null;

        // URL ?size= overrides MAX_HALF for this run.
        if (cfg && cfg.size) {
            this.MAX_HALF = (cfg.size - 1) / 2;
        }

        var types  = cfg ? cfg.types  : ["knight","knight"];
        var starts = cfg ? cfg.starts : null;

        // Assign starting squares.
        // Default: piece i starts on spiral square i.
        var n = types.length;
        var used_coords = {};

        var color_order = (cfg && cfg.colors) ? cfg.colors : null;

        for (var i = 0; i < n; i++) {
            var cidx  = color_order ? color_order[i] : (i % 7);
            var sq = starts ? starts[i] : i;
            var coord = this.spiral_coord(sq);

            // If two pieces share the same starting square by config,
            // bump to the next unoccupied square.
            while (used_coords[this.key(coord.x, coord.y)]) {
                sq++;
                coord = this.spiral_coord(sq);
            }

            this.pieces.push({
                type      : types[i],
                color_idx : cidx,
                x         : coord.x,
                y         : coord.y,
                sequence  : [this.spiral_index(coord.x, coord.y)]
            });
            this.color_type[cidx] = types[i];
            this.painted[this.key(coord.x, coord.y)] = cidx;
            used_coords[this.key(coord.x, coord.y)] = true;
        }

        // Initial board: big enough to show all starting squares.
        var init_half = 4;
        var max_ext   = 0;
        for (var j = 0; j < this.pieces.length; j++) {
            var pm = Math.max(Math.abs(this.pieces[j].x), Math.abs(this.pieces[j].y));
            if (pm > init_half) init_half = pm;
            if (pm > max_ext)   max_ext   = pm;
        }
        this._max_extent = max_ext;
        this.layout(init_half);
    },

    key: function(x, y) { return x + "," + y; },

    // ==========================================================
    // Spiral numbering (identical to knights_stranding)
    // ==========================================================

    spiral_index: function(x, y) {
        var k = Math.max(Math.abs(x), Math.abs(y));
        if (k === 0) return 0;
        var s = (2*k-1)*(2*k-1);
        if (x === k && y < k)  return s + ((k-1) - y);
        if (y === -k)          return s + (2*k) + ((k-1) - x);
        if (x === -k)          return s + (4*k) + (y + (k-1));
        return                        s + (6*k) + (x + (k-1));
    },

    spiral_coord: function(n) {
        if (n === 0) return { x:0, y:0 };
        var k = Math.ceil((Math.sqrt(n)+1)/2);
        while ((2*k-1)*(2*k-1) > n) k--;
        while ((2*k+1)*(2*k+1) <= n) k++;
        var s   = (2*k-1)*(2*k-1);
        var off = n - s;
        var seg = Math.floor(off / (2*k));
        var i   = off - seg*(2*k);
        if (seg === 0) return { x: k,           y: (k-1)-i   };
        if (seg === 1) return { x: (k-1)-i,     y: -k        };
        if (seg === 2) return { x: -k,           y: -(k-1)+i  };
        return                { x: -(k-1)+i,     y: k         };
    },

    // ==========================================================
    // Board layout
    // ==========================================================

    layout: function(half) {
        var side   = 2*half+1;
        var maxpx  = Math.floor(Math.min(this.W, this.H) * 0.9);
        var cell   = Math.floor(maxpx / side);
        if (cell < 4) cell = 4;
        var board_px = cell * side;
        this.half    = half;
        this.side    = side;
        this.cell    = cell;
        this.frame_w = Math.max(6, Math.floor(cell * 0.18));
        this.board_x = Math.floor((this.W - board_px) / 2);
        this.board_y = Math.floor((this.H - board_px) / 2);
    },

    cell_center: function(x, y) {
        var col = this.half + x;
        var row = this.half + y;
        return {
            x: this.board_x + col*this.cell + this.cell/2,
            y: this.board_y + row*this.cell + this.cell/2
        };
    },

    // ==========================================================
    // Piece movement: reachable squares
    // ==========================================================

    is_occupied: function(x, y) {
        for (var i = 0; i < this.pieces.length; i++) {
            if (this.pieces[i].x === x && this.pieces[i].y === y) return true;
        }
        return false;
    },

    // Squares attacked FROM (x,y) by a piece of given type.
    // Sliders are blocked by painted or occupied squares (the
    // blocking square itself is NOT included in the attack set).
    attacks_from: function(x, y, type) {
        var type_def = this.PIECE_TYPES[type];
        var results  = [];

        if (type_def.kind === "jumper") {
            var offs = type_def.offsets;
            for (var i = 0; i < offs.length; i++) {
                var nx = x + offs[i][0];
                var ny = y + offs[i][1];
                if (Math.abs(nx) > this.MAX_HALF || Math.abs(ny) > this.MAX_HALF) continue;
                results.push({ x:nx, y:ny });
            }
        } else if (type_def.kind === "slider") {
            var rays = type_def.rays;
            var limit = this.MAX_HALF + 2;
            for (var r = 0; r < rays.length; r++) {
                var dx = rays[r][0], dy = rays[r][1];
                var cx = x + dx, cy = y + dy;
                var steps = 0;
                while (steps < limit) {
                    steps++;
                    if (Math.abs(cx) > this.MAX_HALF || Math.abs(cy) > this.MAX_HALF) break;
                    var ck = this.key(cx, cy);
                    if (this.is_occupied(cx, cy)) break;
                    if (this.painted.hasOwnProperty(ck)) break;
                    results.push({ x:cx, y:cy });
                    cx += dx;
                    cy += dy;
                }
            }
        }
        return results;
    },

    // Squares attacked by any painted cell whose color is NOT
    // the given exclude_color, using each color's piece type.
    attacked_set: function(exclude_color) {
        var set = {};
        for (var k in this.painted) {
            if (!this.painted.hasOwnProperty(k)) continue;
            var c = this.painted[k];
            if (c === exclude_color) continue;
            var t = this.color_type[c];
            if (!t) continue;
            var parts = k.split(",");
            var px = parseInt(parts[0], 10);
            var py = parseInt(parts[1], 10);
            var atk = this.attacks_from(px, py, t);
            for (var i = 0; i < atk.length; i++) {
                set[this.key(atk[i].x, atk[i].y)] = true;
            }
        }
        return set;
    },

    // True if an unpainted, unoccupied candidate (x,y) is attacked by
    // any painted square whose color is not exclude_color. Used by the
    // standard move planner to avoid rebuilding a full attacked-square
    // map for every move.
    is_attacked_by_other_color: function(x, y, exclude_color) {
        for (var c = 0; c < this.color_type.length; c++) {
            if (c === exclude_color) continue;
            var t = this.color_type[c];
            if (!t) continue;
            var type_def = this.PIECE_TYPES[t];

            if (type_def.kind === "jumper") {
                var offs = type_def.offsets;
                for (var i = 0; i < offs.length; i++) {
                    var sx = x - offs[i][0];
                    var sy = y - offs[i][1];
                    if (Math.abs(sx) > this.MAX_HALF || Math.abs(sy) > this.MAX_HALF) continue;
                    var sk = this.key(sx, sy);
                    if (this.painted.hasOwnProperty(sk) && this.painted[sk] === c) {
                        return true;
                    }
                }
            } else if (type_def.kind === "slider") {
                var rays = type_def.rays;
                for (var r = 0; r < rays.length; r++) {
                    var dx = rays[r][0], dy = rays[r][1];
                    var cx = x - dx, cy = y - dy;
                    while (Math.abs(cx) <= this.MAX_HALF && Math.abs(cy) <= this.MAX_HALF) {
                        var ck = this.key(cx, cy);
                        if (this.painted.hasOwnProperty(ck)) {
                            if (this.painted[ck] === c) return true;
                            break;
                        }
                        if (this.is_occupied(cx, cy)) break;
                        cx -= dx;
                        cy -= dy;
                    }
                }
            }
        }
        return false;
    },

    should_materialize_attacks: function(exclude_color) {
        for (var c = 0; c < this.color_type.length; c++) {
            if (c === exclude_color) continue;
            if (this.color_type[c] === "bishop") return true;
        }
        return false;
    },

    // Walk spiral indices 0,1,2,... and return the first square
    // that is unoccupied, unpainted, and not attacked by any
    // other color's painted squares. null => deadlock.
    plan_move: function(idx) {
        var p   = this.pieces[idx];
        var cap = (2 * this.MAX_HALF + 1) * (2 * this.MAX_HALF + 1);

        // Ludicrous fast path: per-color attacker bitmask + painted
        // grid in typed arrays. Only valid when no sliders are in play.
        if (this._ludicrous_ready && this._all_jumpers) {
            this._grid_ensure();
            var gpainted    = this._grid_painted;
            var gmask       = this._grid_mask;
            var ghalf       = this._grid_half;
            var gside       = this._grid_side;
            var others_bits = (~(1 << p.color_idx)) & 0x7f;
            var start_n     = this._search_from[p.color_idx] | 0;
            for (var n = start_n; n < cap; n++) {
                var coord = this.spiral_coord(n);
                var cx = coord.x, cy = coord.y;
                if (cx < -this.MAX_HALF || cx > this.MAX_HALF) return null;
                if (cy < -this.MAX_HALF || cy > this.MAX_HALF) return null;
                // If outside the current grid, the square has no paint
                // and no attackers (no piece has reached it). Accept it.
                if (cx < -ghalf || cx > ghalf || cy < -ghalf || cy > ghalf) {
                    return { x:cx, y:cy, index:n };
                }
                var gi = (cy + ghalf) * gside + (cx + ghalf);
                if (gpainted[gi] !== 0) continue;
                if ((gmask[gi] & others_bits) !== 0) continue;
                return { x:cx, y:cy, index:n };
            }
            return null;
        }

        // Standard path. Direct candidate tests are faster for rook
        // rays; bishop diagonals are faster as a materialized set.
        var use_attacked_set = this.should_materialize_attacks(p.color_idx);
        var attacked = use_attacked_set ? this.attacked_set(p.color_idx) : null;
        for (var n2 = 0; n2 < cap; n2++) {
            var c2 = this.spiral_coord(n2);
            if (Math.abs(c2.x) > this.MAX_HALF) return null;
            if (Math.abs(c2.y) > this.MAX_HALF) return null;
            var k2 = this.key(c2.x, c2.y);
            if (this.painted.hasOwnProperty(k2)) continue;
            if (this.is_occupied(c2.x, c2.y)) continue;
            if (use_attacked_set) {
                if (attacked[k2]) continue;
            } else if (this.is_attacked_by_other_color(c2.x, c2.y, p.color_idx)) {
                continue;
            }
            return { x:c2.x, y:c2.y, index:n2 };
        }
        return null;
    },

    // Ensure the typed-array grids are at least as large as this.half.
    // Grid only grows; it can be larger than the visible board so that
    // attack bits for squares just outside it are not lost.
    _grid_ensure: function() {
        if (this._grid_half >= this.half) return;
        this._grid_grow_to(this.half);
    },

    // Engage LUDICROUS SPEED: build typed-array grids from current state.
    _ludicrous_enable: function() {
        // Check whether every piece is a jumper (no sliders).
        this._all_jumpers = true;
        for (var i = 0; i < this.pieces.length; i++) {
            if (this.PIECE_TYPES[this.pieces[i].type].kind !== "jumper") {
                this._all_jumpers = false;
                break;
            }
        }

        // Reset grids and size to fit current board + all attack reach.
        this._grid_painted = null;
        this._grid_mask    = null;
        this._grid_half    = -1;
        this._grid_side    = 0;

        var need_half = this.half;
        for (var k0 in this.painted) {
            if (!this.painted.hasOwnProperty(k0)) continue;
            var c0 = this.painted[k0];
            var t0 = this.color_type[c0];
            if (!t0) continue;
            var pp0 = k0.split(",");
            var px0 = parseInt(pp0[0], 10), py0 = parseInt(pp0[1], 10);
            var atk0 = this.attacks_from(px0, py0, t0);
            for (var z = 0; z < atk0.length; z++) {
                var zx = atk0[z].x, zy = atk0[z].y;
                if (zx < 0) zx = -zx;
                if (zy < 0) zy = -zy;
                if (zx > need_half) need_half = zx;
                if (zy > need_half) need_half = zy;
            }
        }
        this._grid_grow_to(need_half);

        // Per-color spiral search cursors. Start at 0; will be bumped
        // past chosen squares on each plan_move success.
        var nc = this.PALETTE.length;
        this._search_from = new Int32Array(nc);

        var gpainted = this._grid_painted;
        var gmask    = this._grid_mask;
        var ghalf    = this._grid_half;
        var gside    = this._grid_side;

        for (var k in this.painted) {
            if (!this.painted.hasOwnProperty(k)) continue;
            var c     = this.painted[k];
            var t     = this.color_type[c];
            if (!t) continue;
            var parts = k.split(",");
            var px    = parseInt(parts[0], 10);
            var py    = parseInt(parts[1], 10);
            var pi    = (py + ghalf) * gside + (px + ghalf);
            gpainted[pi] = c + 1;
            var atk = this.attacks_from(px, py, t);
            var bit = (1 << c);
            for (var i2 = 0; i2 < atk.length; i2++) {
                var ax = atk[i2].x, ay = atk[i2].y;
                if (ax < -ghalf || ax > ghalf || ay < -ghalf || ay > ghalf) continue;
                var ai = (ay + ghalf) * gside + (ax + ghalf);
                gmask[ai] = gmask[ai] | bit;
            }
        }
        this._ludicrous_ready = true;
    },

    // Called after a square (x,y) is freshly painted with color c.
    _paint_event: function(x, y, c) {
        // Maintain running max extent so required_half() is O(1).
        var ax_ = x < 0 ? -x : x;
        var ay_ = y < 0 ? -y : y;
        if (ax_ > this._max_extent) this._max_extent = ax_;
        if (ay_ > this._max_extent) this._max_extent = ay_;

        // Always stamp pixel offscreen if it exists and is current.
        this._pixel_off_stamp(x, y, c);

        if (!this._ludicrous_ready) return;
        if (!this._all_jumpers) return;
        var t = this.color_type[c];
        if (!t) return;

        var atk = this.attacks_from(x, y, t);

        // Grow grid to fit BOTH the painted square and every attacked
        // square -- otherwise attack bits beyond the current grid would
        // be silently dropped and never recovered on later grow.
        var need_ext = this._max_extent;
        for (var ai = 0; ai < atk.length; ai++) {
            var aax = atk[ai].x, aay = atk[ai].y;
            if (aax < 0) aax = -aax;
            if (aay < 0) aay = -aay;
            if (aax > need_ext) need_ext = aax;
            if (aay > need_ext) need_ext = aay;
        }
        if (need_ext > this._grid_half) this._grid_grow_to(need_ext);
        else                            this._grid_ensure();

        var gpainted = this._grid_painted;
        var gmask    = this._grid_mask;
        var ghalf    = this._grid_half;
        var gside    = this._grid_side;

        var pi = (y + ghalf) * gside + (x + ghalf);
        gpainted[pi] = c + 1;

        var bit = (1 << c);
        for (var i = 0; i < atk.length; i++) {
            var ai_x = atk[i].x, ai_y = atk[i].y;
            var ai_idx = (ai_y + ghalf) * gside + (ai_x + ghalf);
            gmask[ai_idx] = gmask[ai_idx] | bit;
        }
    },

    // Grow grid to a target half (independent of this.half) so that
    // attack bits for squares slightly outside the visible board can
    // still be recorded.
    _grid_grow_to: function(target_half) {
        if (this._grid_half >= target_half) return;
        var new_half = target_half;
        var new_side = 2 * new_half + 1;
        var new_p    = new Uint8Array(new_side * new_side);
        var new_m    = new Uint8Array(new_side * new_side);
        if (this._grid_painted && this._grid_half >= 0) {
            var old_half = this._grid_half;
            var old_side = this._grid_side;
            var off      = new_half - old_half;
            for (var r = 0; r < old_side; r++) {
                var dst_off = (r + off) * new_side + off;
                var src_off = r * old_side;
                new_p.set(this._grid_painted.subarray(src_off, src_off + old_side), dst_off);
                new_m.set(this._grid_mask.subarray(src_off, src_off + old_side),    dst_off);
            }
        }
        this._grid_painted = new_p;
        this._grid_mask    = new_m;
        this._grid_half    = new_half;
        this._grid_side    = new_side;
    },

    // Required board half to show all pieces and all painted squares
    // plus the next planned destination for the active piece.
    required_half: function(planned_move) {
        // _max_extent is maintained incrementally and already covers
        // every piece and every painted square (pieces ARE painted).
        var need = this._max_extent | 0;
        if (need < 4) need = 4;
        // Expand to show the planned destination for the active piece.
        var move = (arguments.length > 0) ? planned_move : this.plan_move(this.turn);
        if (move) {
            var mx = move.x < 0 ? -move.x : move.x;
            var my = move.y < 0 ? -move.y : move.y;
            if (mx > need) need = mx;
            if (my > need) need = my;
        }
        return need;
    },

    // ==========================================================
    // Drawing -- chess mode
    // ==========================================================

    draw_felt: function() {
        var ctx = this.ctx;

        // LUDICROUS SPEED gets a plaid (tartan) background.
        if (this.speed_mode === "ludicrous") {
            this.draw_plaid();
            return;
        }

        ctx.fillStyle = this.FELT;
        ctx.fillRect(0, 0, this.W, this.H);

        ctx.save();
        var count = Math.floor((this.W * this.H) / 6000);
        var board_px = this.cell * this.side;
        var bx = this.board_x, by = this.board_y;
        var fw = this.frame_w;
        for (var i = 0; i < count; i++) {
            var seed = i * 3;
            var sx = this.felt_noise_value(seed);
            var sy = this.felt_noise_value(seed + 1);
            var x = sx * this.W;
            var y = sy * this.H;
            if (x >= bx-fw && x < bx+board_px+fw &&
                y >= by-fw && y < by+board_px+fw) continue;
            ctx.fillStyle = this.felt_noise_value(seed + 2) < 0.5
                ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.04)";
            ctx.fillRect(x, y, 1, 1);
        }
        ctx.restore();
    },

    felt_noise_value: function(seed) {
        var n = (seed + 1) * 1103515245 + 12345;
        n = (n ^ (n >>> 16)) >>> 0;
        return (n & 0xffff) / 0x10000;
    },

    // Classic crossed-tartan plaid background for LUDICROUS SPEED.
    // Uses the gunn.gif (Gunn clan tartan) baked-in data URL when the
    // image has finished decoding; falls back to a procedural stripe
    // pattern for the first few frames while the data URL loads.
    _ensure_plaid_pattern: function() {
        if (this._plaid_pattern) return this._plaid_pattern;
        if (this._plaid_loading) return null;
        this._plaid_loading = true;
        var self = this;
        var img = new Image();
        img.onload = function() {
            self._plaid_img = img;
            try {
                self._plaid_pattern = self.ctx.createPattern(img, "repeat");
            } catch (e) {
                self._plaid_pattern = null;
            }
        };
        img.onerror = function() {
            // Leave _plaid_pattern null; draw_plaid falls back to procedural.
            self._plaid_loading = false;
        };
        img.src = this.GUNN_GIF_DATA_URL;
        return null;
    },

    draw_plaid: function() {
        var ctx = this.ctx;
        var W = this.W, H = this.H;

        // Preferred path: tile gunn.gif as a canvas pattern.
        var pat = this._ensure_plaid_pattern();
        if (pat) {
            ctx.fillStyle = pat;
            ctx.fillRect(0, 0, W, H);
            return;
        }

        // Fallback procedural plaid (used until the image decodes,
        // or if the image fails to load for some reason).
        ctx.fillStyle = "#0a3a1a";
        ctx.fillRect(0, 0, W, H);

        // Stripe groups: [color, width, period, offset]
        var stripes = [
            ["rgba(180,30,30,0.55)", 26, 120,  0],   // wide red
            ["rgba(20,40,140,0.45)", 14, 120, 60],   // medium blue
            ["rgba(245,240,220,0.45)", 4, 60,  30],  // narrow cream
            ["rgba(0,0,0,0.35)",      2, 30,  0]     // thin black
        ];

        // Vertical stripes.
        for (var s = 0; s < stripes.length; s++) {
            var col = stripes[s][0];
            var w   = stripes[s][1];
            var per = stripes[s][2];
            var off = stripes[s][3];
            ctx.fillStyle = col;
            for (var x = (off % per) - per; x < W; x += per) {
                ctx.fillRect(x, 0, w, H);
            }
        }
        // Horizontal stripes (same set, perpendicular).
        for (var s2 = 0; s2 < stripes.length; s2++) {
            var col2 = stripes[s2][0];
            var w2   = stripes[s2][1];
            var per2 = stripes[s2][2];
            var off2 = stripes[s2][3];
            ctx.fillStyle = col2;
            for (var y = (off2 % per2) - per2; y < H; y += per2) {
                ctx.fillRect(0, y, W, w2);
            }
        }
    },

    draw_frame: function() {
        var ctx = this.ctx;
        var fw  = this.frame_w;
        var bx  = this.board_x, by = this.board_y;
        var bs  = this.cell * this.side;

        ctx.save();
        ctx.shadowColor   = "rgba(0,0,0,0.5)";
        ctx.shadowBlur    = fw * 0.6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = fw * 0.3;
        ctx.fillStyle = this.FRAME;
        ctx.fillRect(bx-fw, by-fw, bs+fw*2, bs+fw*2);
        ctx.restore();

        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx-fw+0.5, by-fw+0.5, bs+fw*2-1, bs+fw*2-1);
    },

    draw_squares: function() {
        var ctx = this.ctx;
        for (var y = -this.half; y <= this.half; y++) {
            for (var x = -this.half; x <= this.half; x++) {
                var col = this.half+x, row = this.half+y;
                var light = ((col+row) & 1) === 0;
                ctx.fillStyle = light ? this.LIGHT : this.DARK;
                ctx.fillRect(
                    this.board_x + col*this.cell,
                    this.board_y + row*this.cell,
                    this.cell, this.cell
                );
            }
        }
    },

    draw_painted: function() {
        var ctx = this.ctx;
        for (var k in this.painted) {
            if (!this.painted.hasOwnProperty(k)) continue;
            var p = k.split(",");
            var x = parseInt(p[0],10), y = parseInt(p[1],10);
            if (Math.abs(x) > this.half || Math.abs(y) > this.half) continue;
            var col = this.half+x, row = this.half+y;
            ctx.fillStyle = this.PALETTE[this.painted[k]].tint;
            ctx.fillRect(
                this.board_x + col*this.cell,
                this.board_y + row*this.cell,
                this.cell, this.cell
            );
        }
    },

    draw_numbers: function() {
        var ctx = this.ctx;
        var size = Math.max(8, Math.floor(this.cell * 0.30));
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";

        for (var y = -this.half; y <= this.half; y++) {
            for (var x = -this.half; x <= this.half; x++) {
                var idx = this.spiral_index(x, y);
                var k   = this.key(x, y);
                var col = this.half+x, row = this.half+y;
                var cx  = this.board_x + col*this.cell + this.cell/2;
                var cy  = this.board_y + row*this.cell + this.cell/2;

                if (this.painted.hasOwnProperty(k)) {
                    ctx.font = "bold " + size + "px sans-serif";
                    ctx.fillStyle = this.PALETTE[this.painted[k]].num;
                } else {
                    ctx.font = size + "px sans-serif";
                    var light = ((col+row) & 1) === 0;
                    ctx.fillStyle = light ? this.NUM_LIGHT : this.NUM_DARK;
                }
                ctx.fillText("" + idx, cx, cy);
            }
        }
    },

    draw_piece: function(piece_idx, px, py) {
        var p   = this.pieces[piece_idx];
        var pal = this.PALETTE[p.color_idx];
        var ctx = this.ctx;
        var size = Math.floor(this.cell * 0.78);
        ctx.font = size + "px serif";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";

        ctx.save();
        ctx.shadowColor   = "rgba(0,0,0,0.55)";
        ctx.shadowBlur    = Math.max(4, this.cell*0.12);
        ctx.shadowOffsetY = Math.max(1, this.cell*0.04);
        ctx.shadowOffsetX = 0;

        ctx.fillStyle = this.GLYPH_HALO;
        ctx.fillText(this.PIECE_TYPES[p.type].glyph, px+1, py+1);

        ctx.shadowBlur = 0;
        ctx.fillStyle  = pal.glyph;
        ctx.fillText(this.PIECE_TYPES[p.type].glyph, px, py);
        ctx.restore();
    },

    draw_readout: function() {
        var ctx  = this.ctx;
        var n    = this.pieces.length;
        var size = Math.max(10, Math.floor(Math.min(this.W,this.H) * 0.016));
        if (n > 4) size = Math.max(8, Math.floor(size * 0.8));
        ctx.font = size + "px monospace";
        ctx.textAlign    = "left";
        ctx.textBaseline = "bottom";

        var pad      = 10;
        var max_tail = 20;
        var box_h    = size * n + pad * 2;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, this.H - box_h, this.W, box_h);

        for (var i = 0; i < n; i++) {
            var p    = this.pieces[i];
            var pal  = this.PALETTE[p.color_idx];
            var seq  = p.sequence;
            var tail = seq.slice(Math.max(0, seq.length - max_tail));
            var line = pal.name + " [" + seq.length + "]: " +
                       (seq.length > max_tail ? "... " : "") + tail.join(" ");
            var y    = this.H - pad - (n-1-i)*size;

            // white backdrop first
            ctx.fillStyle = this.GLYPH_HALO;
            ctx.fillText(line, pad, y);
            // colored label
            ctx.fillStyle = pal.glyph;
            ctx.fillText(pal.name, pad, y);
        }
    },

    // ==========================================================
    // Drawing -- pixel mode
    // ==========================================================

    // Compute scale and offset for pixel mode so the board fits the window.
    pixel_layout: function() {
        var scale = Math.min(this.W / this.side, this.H / this.side);
        if (scale < 1) scale = 1;
        this.pixel_scale  = scale;
        this.pixel_off_x  = Math.floor((this.W  - scale * this.side) / 2);
        this.pixel_off_y  = Math.floor((this.H  - scale * this.side) / 2);
    },

    draw_pixel_board: function() {
        var ctx    = this.ctx;
        var scale  = this.pixel_scale;
        var off_x  = this.pixel_off_x;
        var off_y  = this.pixel_off_y;
        var half   = this.half;
        var colors = this.PIXEL_COLORS;

        // Canvas background (outside the board).
        if (this.speed_mode === "ludicrous") {
            this.draw_plaid();
        } else {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, this.W, this.H);
        }

        // Fast path: blit the offscreen 1-px-per-cell snapshot.
        if (this._pixel_off && this._pixel_off_half === half) {
            var board_px2 = Math.max(1, Math.ceil(scale * this.side));
            // Nearest-neighbor scaling for crisp pixels.
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this._pixel_off, off_x, off_y, board_px2, board_px2);

            for (var i = 0; i < this.pieces.length; i++) {
                var p   = this.pieces[i];
                var col2 = half + p.x;
                var row2 = half + p.y;
                var px  = off_x + Math.floor(col2 * scale);
                var py  = off_y + Math.floor(row2 * scale);
                var sz  = Math.max(2, Math.ceil(scale));
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(px, py, sz, sz);
            }
            return;
        }

        // Standard path: per-cell fillRect.
        var board_px = Math.max(1, Math.ceil(scale * this.side));
        ctx.fillStyle = "#5fcf6a";
        ctx.fillRect(off_x, off_y, board_px, board_px);

        for (var k in this.painted) {
            if (!this.painted.hasOwnProperty(k)) continue;
            var parts = k.split(",");
            var bx = parseInt(parts[0], 10);
            var by = parseInt(parts[1], 10);
            var col = half + bx;
            var row = half + by;
            ctx.fillStyle = colors[this.painted[k]];
            ctx.fillRect(
                off_x + Math.floor(col * scale),
                off_y + Math.floor(row * scale),
                Math.max(1, Math.ceil(scale)),
                Math.max(1, Math.ceil(scale))
            );
        }

        for (var i2 = 0; i2 < this.pieces.length; i2++) {
            var pp   = this.pieces[i2];
            var col3 = half + pp.x;
            var row3 = half + pp.y;
            var px2  = off_x + Math.floor(col3 * scale);
            var py2  = off_y + Math.floor(row3 * scale);
            var sz2  = Math.max(2, Math.ceil(scale));
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(px2, py2, sz2, sz2);
        }
    },

    // Ensure the 1-cell-per-pixel offscreen exists and matches the
    // current board half. On grow, the old contents are blitted into
    // the centered region of a new larger canvas. New border area is
    // filled with the unpainted background color.
    _pixel_off_ensure: function() {
        var half = this.half;
        var side = this.side;
        if (this._pixel_off && this._pixel_off_half === half) return;

        var c   = document.createElement("canvas");
        c.width = side;
        c.height = side;
        var cx = c.getContext("2d");
        cx.imageSmoothingEnabled = false;
        cx.fillStyle = "#5fcf6a";
        cx.fillRect(0, 0, side, side);

        if (this._pixel_off && this._pixel_off_half >= 0) {
            // Center the old image into the new larger one.
            var old_side = 2 * this._pixel_off_half + 1;
            var off      = half - this._pixel_off_half;  // border in cells
            cx.drawImage(this._pixel_off, off, off);
        } else {
            // First creation: paint existing painted cells in one pass.
            var colors = this.PIXEL_COLORS;
            for (var k in this.painted) {
                if (!this.painted.hasOwnProperty(k)) continue;
                var parts = k.split(",");
                var bx    = parseInt(parts[0], 10);
                var by    = parseInt(parts[1], 10);
                cx.fillStyle = colors[this.painted[k]];
                cx.fillRect(half + bx, half + by, 1, 1);
            }
        }

        this._pixel_off       = c;
        this._pixel_off_ctx   = cx;
        this._pixel_off_half  = half;
    },

    // Stamp a single painted cell into the offscreen snapshot.
    _pixel_off_stamp: function(x, y, color_idx) {
        if (!this._pixel_off) return;
        if (this._pixel_off_half !== this.half) return;
        this._pixel_off_ctx.fillStyle = this.PIXEL_COLORS[color_idx];
        this._pixel_off_ctx.fillRect(this.half + x, this.half + y, 1, 1);
    },

    // Overlay showing move count in pixel mode.
    draw_pixel_hud: function() {
        var ctx  = this.ctx;
        var size = Math.max(12, Math.floor(Math.min(this.W,this.H) * 0.022));
        ctx.font = "bold " + size + "px monospace";
        ctx.textAlign    = "right";
        ctx.textBaseline = "top";
        var txt = "moves: " + this.moves_done + "  board: " + this.side + "x" + this.side;
        // Opaque backdrop so the HUD can be redrawn every frame without
        // the board underneath being repainted (avoids text smear when
        // digits change).
        var pad = Math.max(4, Math.floor(size * 0.4));
        var tw  = ctx.measureText(txt).width;
        var bx  = this.W - 10 - tw - pad;
        var by  = 9 - pad;
        var bw  = tw + pad * 2;
        var bh  = size + pad * 2;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillText(txt, this.W - 10, 10);
        ctx.fillStyle = "#ffe600";
        ctx.fillText(txt, this.W - 11, 9);
    },

    // Hide the active-run buttons and reveal the SAVE IMAGE button
    // when the run reaches a terminal state. Disappearance of the
    // speed and sequence buttons is the visual cue that animation
    // has stopped.
    _hide_chrome: function() {
        this.run_ended = true;
        var ids = ["speed_btn", "dump_btn"];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el) el.style.display = "none";
        }
        var save = document.getElementById("save_img_btn");
        if (save) save.style.display = "block";
    },

    // Download the current canvas as a PNG. Filename encodes the
    // configured board side and total moves so the file is
    // self-identifying without any in-image overlay.
    save_image: function() {
        var self = this;
        var side = 2 * this.MAX_HALF + 1;
        var ts   = new Date().toISOString().replace(/[:.]/g, "-");
        var name = "knights_spiral-" + side + "-" + this.moves_done +
                   "moves-" + ts + ".png";
        this.canvas.toBlob(function(blob) {
            if (!blob) return;
            var url = URL.createObjectURL(blob);
            var a   = document.createElement("a");
            a.href     = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function(){ URL.revokeObjectURL(url); }, 0);
            var btn = document.getElementById("save_img_btn");
            if (btn) btn.style.display = "none";
        }, "image/png");
    },

    // ==========================================================
    // Banner draws
    // ==========================================================

    draw_banner: function(title, title_color, lines) {
        var ctx  = this.ctx;
        var s1   = Math.max(28, Math.floor(Math.min(this.W,this.H) * 0.06));
        var s2   = Math.max(14, Math.floor(s1 * 0.40));
        var pad  = Math.floor(s1 * 0.7);
        var box_h = s1 + lines.length * (s2 + Math.floor(s1*0.2)) + pad * 2;
        var box_y = Math.floor((this.H - box_h) / 2);

        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, box_y, this.W, box_h);

        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";

        ctx.font      = "bold " + s1 + "px sans-serif";
        ctx.fillStyle = title_color;
        ctx.fillText(title, this.W/2, box_y + pad + s1/2);

        for (var i = 0; i < lines.length; i++) {
            ctx.font = s2 + "px sans-serif";
            ctx.fillStyle = (i === 0) ? this.GLYPH_HALO : "#d8c8a8";
            ctx.fillText(lines[i], this.W/2,
                box_y + pad + s1 + Math.floor(s1*0.3) + i*(s2 + Math.floor(s1*0.2)) + s2/2);
        }
        ctx.restore();
    },

    draw_deadlock_highlight: function() {
        if (!this.deadlock_cell) return;
        var ctx = this.ctx;
        var c   = this.deadlock_cell;
        var col = this.half + c.x;
        var row = this.half + c.y;
        var x   = this.board_x + col*this.cell;
        var y   = this.board_y + row*this.cell;
        var sz  = this.cell;

        ctx.save();
        ctx.fillStyle = "rgba(255,230,0,0.55)";
        ctx.fillRect(x, y, sz, sz);

        ctx.shadowColor = "rgba(255,230,0,0.95)";
        ctx.shadowBlur  = Math.max(8, Math.floor(sz*0.5));
        ctx.strokeStyle = "#ffe600";
        ctx.lineWidth   = Math.max(3, Math.floor(sz*0.12));
        ctx.strokeRect(x + ctx.lineWidth/2, y + ctx.lineWidth/2,
                       sz - ctx.lineWidth, sz - ctx.lineWidth);
        ctx.restore();

        var p  = this.pieces[this.deadlock_piece];
        var cc = this.cell_center(p.x, p.y);
        this.draw_piece(this.deadlock_piece, cc.x, cc.y);
    },

    draw_deadlock_banner: function() {
        var who  = this.PALETTE[this.pieces[this.deadlock_piece].color_idx].name;
        var type = this.pieces[this.deadlock_piece].type.toUpperCase();
        this.draw_banner(
            "DEADLOCK",
            this.PALETTE[this.pieces[this.deadlock_piece].color_idx].glyph,
            [
                who + " " + type + " stuck on move " + (this.moves_done + 1),
                "spiral cell " + this.spiral_index(this.deadlock_cell.x, this.deadlock_cell.y),
                "reload the page to start a new run"
            ]
        );
    },

    draw_capped_banner: function() {
        // Solid green felt covers any prior plaid/black background so
        // the terminal screen presents cleanly.
        this.ctx.fillStyle = this.FELT;
        this.ctx.fillRect(0, 0, this.W, this.H);
        this.draw_banner(
            "BOARD LIMIT",
            "#ffe600",
            [
                "board reached " + this.side + " x " + this.side,
                "sequence stopped at move " + this.moves_done,
                "reload to start a new run"
            ]
        );
    },

    draw_moves_limit_banner: function() {
        this.ctx.fillStyle = this.FELT;
        this.ctx.fillRect(0, 0, this.W, this.H);
        this.draw_banner(
            "MOVES LIMIT",
            "#ffe600",
            [
                "stopped after " + this.moves_done + " moves",
                "board: " + this.side + " x " + this.side,
                "reload to start a new run"
            ]
        );
    },

    // ==========================================================
    // Speed toggle
    // ==========================================================

    toggle_speed: function() {
        // Cycle slow -> fast -> superfast -> light -> ludicrous -> slow
        if (this.speed_mode === "slow") {
            this.speed_mode = "fast";
            this.MOVE_MS = this.FAST_MOVE_MS;
            this.GROW_MS = this.FAST_GROW_MS;
        } else if (this.speed_mode === "fast") {
            this.speed_mode = "superfast";
            this.MOVE_MS = this.SUPERFAST_MOVE_MS;
            this.GROW_MS = this.SUPERFAST_GROW_MS;
        } else if (this.speed_mode === "superfast") {
            this.speed_mode = "light";
            this.MOVE_MS = this.LIGHT_MOVE_MS;
            this.GROW_MS = this.LIGHT_GROW_MS;
        } else if (this.speed_mode === "light") {
            this.speed_mode = "ludicrous";
            this.MOVE_MS = this.LUDICROUS_MOVE_MS;
            this.GROW_MS = this.LUDICROUS_GROW_MS;
            // Flush any in-flight chess-mode animation BEFORE building
            // ludicrous caches and the pixel snapshot. Otherwise an
            // un-applied move or a pending grow can paint a square
            // outside the snapshot canvas, leaving a permanent hole
            // in the final image.
            if (this.phase === "growing" && this.tween) {
                this.layout(this.tween.to_half);
                this.tween = null;
            }
            if (this.phase === "moving" && this.move_to) {
                // Finalize the in-flight move into painted state.
                this.finish_move();
                this.move_from = null;
                this.move_to   = null;
            }
            if (this._pending_move) {
                // Grow board to accommodate the pending destination so
                // its paint event lands inside the snapshot.
                var pm = this._pending_move;
                var pneed = Math.abs(pm.x);
                if (Math.abs(pm.y) > pneed) pneed = Math.abs(pm.y);
                if (this._max_extent > pneed) pneed = this._max_extent;
                if (pneed > this.half && pneed <= this.MAX_HALF) {
                    this.layout(pneed);
                }
                this._pending_move = null;
            }
            // Engaging ludicrous: enable fast path and rebuild caches.
            this._ludicrous_enable();
            // Ludicrous implies pixel mode: chess rendering is wasted
            // work at thousands of moves per frame, and pixel mode has
            // a dedicated ludicrous fast path (offscreen snapshot blit).
            if (this.mode === "chess") {
                this.mode = "pixel";
                this.pixel_layout();
                this._pixel_off_ensure();
                // State already flushed above; just enter pixel phase.
                this.phase         = "pixel";
            }
        } else {
            this.speed_mode = "slow";
            this.MOVE_MS = this.SLOW_MOVE_MS;
            this.GROW_MS = this.SLOW_GROW_MS;
        }
        var btn = document.getElementById("speed_btn");
        if (btn) {
            // Label shows what pressing the button will switch TO next.
            if (this.speed_mode === "slow")           btn.textContent = "FAST";
            else if (this.speed_mode === "fast")      btn.textContent = "SUPERFAST";
            else if (this.speed_mode === "superfast") btn.textContent = "LIGHT SPEED";
            else if (this.speed_mode === "light")     btn.textContent = "LUDICROUS SPEED";
            else                                       btn.textContent = "SLOW";
            // Background gif only when button reads "LUDICROUS SPEED" (light mode).
            if (this.speed_mode === "light") {
                btn.style.backgroundImage    = "url('" + this.GUNN_GIF_DATA_URL + "')";
                btn.style.backgroundSize     = "cover";
                btn.style.backgroundPosition = "center";
            } else {
                btn.style.backgroundImage    = "";
                btn.style.backgroundSize     = "";
                btn.style.backgroundPosition = "";
            }
        }
    },

    // ==========================================================
    // Save sequences
    // ==========================================================

    download_sequences: function() {
        var lines = [];
        lines.push("# Knights Spiral -- landing-square sequences");
        lines.push("# moves_completed = " + this.moves_done);
        lines.push("# phase = " + this.phase);
        lines.push("# mode = " + this.mode);
        if (this.deadlock_cell) {
            var who = this.PALETTE[this.pieces[this.deadlock_piece].color_idx].name;
            lines.push("# deadlock = " + who + " at spiral " +
                this.spiral_index(this.deadlock_cell.x, this.deadlock_cell.y));
        }
        for (var i = 0; i < this.pieces.length; i++) {
            var p   = this.pieces[i];
            var pal = this.PALETTE[p.color_idx];
            var trunc = (p.sequence.length >= this.SEQUENCE_MAX) ? " (truncated)" : "";
            lines.push("# piece_" + i + " = " + pal.name + " " + p.type.toUpperCase() +
                " recorded=" + p.sequence.length + trunc);
        }
        lines.push("# sequence_max_per_piece = " + this.SEQUENCE_MAX);
        for (var j = 0; j < this.pieces.length; j++) {
            var q   = this.pieces[j];
            var pl2 = this.PALETTE[q.color_idx];
            lines.push(pl2.name + "_" + q.type.toUpperCase() + " " + q.sequence.join(" "));
        }
        var text = lines.join("\n") + "\n";
        var blob = new Blob([text], { type:"text/plain;charset=utf-8" });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement("a");
        var ts   = new Date().toISOString().replace(/[:.]/g,"-");
        a.href     = url;
        a.download = "knights_spiral-" + ts + ".txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 0);
    },

    // ==========================================================
    // Frame loop helpers
    // ==========================================================

    ease: function(t) {
        return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
    },

    begin_turn: function(ts) {
        // Check moves limit (&moves= param).
        if (this.max_moves !== null && this.moves_done >= this.max_moves) {
            this.phase    = "moves_limit";
            this.phase_ts = ts;
            return;
        }
        var move = this.plan_move(this.turn);
        if (!move) {
            // Stuck.
            var p = this.pieces[this.turn];
            this.deadlock_piece = this.turn;
            this.deadlock_cell  = { x:p.x, y:p.y };
            this.phase    = "deadlock";
            this.phase_ts = ts;
            return;
        }

        var need = Math.max(this.required_half(move),
                            Math.abs(move.x), Math.abs(move.y));

        if (need > this.half) {
            // Board must grow.
            if (need > this.MAX_HALF) {
                // Cap: would exceed 2001x2001.
                this.phase    = "capped";
                this.phase_ts = ts;
                return;
            }

            // Rule 4: if past PIXEL_THRESHOLD, switch to pixel mode on this grow.
            if (this.moves_done >= this.PIXEL_THRESHOLD && this.mode === "chess") {
                this.mode = "pixel";
                this.layout(need);
                this.pixel_layout();
                this._pixel_off_ensure();
                this.start_move_instant(move);
                this.phase = "pixel";
                return;
            }

            this.tween = { start_ts:ts, from_half:this.half, to_half:need };
            this.phase = "growing";
            this.phase_ts = ts;
            this._pending_move = move;
            return;
        }

        if (this.mode === "pixel") {
            this.start_move_instant(move);
            this.phase = "pixel";
            return;
        }

        this.start_move(ts, move);
    },

    start_move: function(ts, move) {
        var p = this.pieces[this.turn];
        this.move_piece = this.turn;
        this.move_from  = { x:p.x, y:p.y };
        this.move_to    = { x:move.x, y:move.y };
        this.phase      = "moving";
        this.phase_ts   = ts;
    },

    start_move_instant: function(move) {
        this.move_piece = this.turn;
        this.move_to    = { x:move.x, y:move.y };
    },

    finish_move: function() {
        var p = this.pieces[this.turn];
        p.x = this.move_to.x;
        p.y = this.move_to.y;
        var sq = this.spiral_index(p.x, p.y);
        this.painted[this.key(p.x, p.y)] = p.color_idx;
        this._paint_event(p.x, p.y, p.color_idx);
        if (p.sequence.length < this.SEQUENCE_MAX) {
            p.sequence.push(sq);
        }
        // Advance per-color cursor: this index is now disqualified
        // for this color (own paint), and every lower index has
        // already been permanently disqualified.
        if (this._search_from && this._all_jumpers) {
            if (sq + 1 > this._search_from[p.color_idx]) {
                this._search_from[p.color_idx] = sq + 1;
            }
        }
        this.moves_done++;
        this.turn = (this.turn + 1) % this.pieces.length;
    },

    // ==========================================================
    // Main frame loop
    // ==========================================================

    frame: function(ts) {
        var self = this;
        var ctx  = this.ctx;

        // --- PIXEL MODE ---
        if (this.mode === "pixel" && this.phase === "pixel") {
            // Ensure offscreen snapshot is current for cheap pixel redraws.
            this._pixel_off_ensure();

            // Run as many moves as possible within budget.
            var budget_end = performance.now() + this.PIXEL_BUDGET_MS;
            var keep_going = true;

            while (keep_going && performance.now() < budget_end) {
                // Check moves limit.
                if (this.max_moves !== null && this.moves_done >= this.max_moves) {
                    this.phase = "moves_limit";
                    keep_going = false;
                    break;
                }
                // Apply the queued move if any.
                if (this.move_to) {
                    this.finish_move();
                    this.move_to = null;
                }

                var move = this.plan_move(this.turn);
                if (!move) {
                    this.phase = "capped";
                    keep_going = false;
                    break;
                }

                var need = Math.max(this.required_half(move),
                                    Math.abs(move.x), Math.abs(move.y));
                if (need > this.half) {
                    if (need > this.MAX_HALF) {
                        this.phase = "capped";
                        keep_going = false;
                        break;
                    }
                    this.layout(need);
                    this.pixel_layout();
                    this._pixel_off_ensure();
                }

                this.start_move_instant(move);
                this.finish_move();
                this.move_to = null;
            }

            // Draw pixel board. PIXEL_DRAW_EVERY can throttle this if
            // the renderer becomes expensive again.
            this._pixel_frame_ctr++;
            var terminal = (this.phase === "capped" ||
                            this.phase === "moves_limit");
            if (terminal || (this._pixel_frame_ctr % this.PIXEL_DRAW_EVERY) === 0) {
                this.pixel_layout();
                this.draw_pixel_board();
            }
            // HUD: redrawn every frame during the run so it remains
            // visible even when the board itself is throttled. The HUD
            // paints its own opaque backdrop, so it overdraws cleanly
            // without forcing a full board redraw. Hidden at terminal.
            if (!terminal) {
                this.draw_pixel_hud();
            }

            if (this.phase === "capped") {
                this._hide_chrome();
                return; // stop
            }
            if (this.phase === "moves_limit") {
                this._hide_chrome();
                return; // stop
            }

            window.requestAnimationFrame(function(t){ self.frame(t); });
            return;
        }

        // --- CHESS MODE ---
        if (this.phase === "idle") {
            this.begin_turn(ts);
        }

        // Growing tween.
        if (this.phase === "growing") {
            var gt = (ts - this.tween.start_ts) / this.GROW_MS;
            if (gt >= 1) {
                this.layout(this.tween.to_half);
                this.tween = null;
                this.start_move(ts, this._pending_move);
                this._pending_move = null;
            } else {
                var e  = this.ease(gt);
                var hn = this.tween.from_half + (this.tween.to_half - this.tween.from_half)*e;
                this.layout(Math.ceil(hn));
            }
        }

        // Draw the board.
        this.draw_felt();
        this.draw_frame();
        this.draw_squares();
        this.draw_painted();
        if (this.moves_done < this.NUMBERS_MAX) {
            this.draw_numbers();
        }

        // Draw stationary pieces.
        for (var i = 0; i < this.pieces.length; i++) {
            if (this.phase === "moving" && i === this.move_piece) continue;
            var pp2 = this.pieces[i];
            var cc  = this.cell_center(pp2.x, pp2.y);
            this.draw_piece(i, cc.x, cc.y);
        }

        // Animate moving piece.
        if (this.phase === "moving") {
            var mt = (ts - this.phase_ts) / this.MOVE_MS;
            if (mt > 1) mt = 1;
            var e2 = this.ease(mt);
            var a  = this.cell_center(this.move_from.x, this.move_from.y);
            var b  = this.cell_center(this.move_to.x,   this.move_to.y);
            var kx = a.x + (b.x - a.x) * e2;
            var ky = a.y + (b.y - a.y) * e2;
            this.draw_piece(this.move_piece, kx, ky);
            if (mt >= 1) {
                this.finish_move();
                // Clear move_to so a subsequent ludicrous toggle does
                // not see a dangling reference and re-apply this move
                // to the next color. (Chess mode otherwise leaves
                // move_to set; pixel mode already clears it explicitly.)
                this.move_from = null;
                this.move_to   = null;
                if (this.phase === "moving") this.phase = "idle";
            }
        }

        // Readout.
        var terminal_phase = (this.phase === "deadlock" ||
                              this.phase === "capped" ||
                              this.phase === "moves_limit");
        if (!this.run_ended && !terminal_phase &&
            this.moves_done < this.READOUT_MAX) {
            this.draw_readout();
        }

        // Terminal states.
        if (this.phase === "deadlock") {
            this._hide_chrome();
            return; // stop scheduling
        }
        if (this.phase === "capped") {
            this._hide_chrome();
            return; // stop scheduling
        }
        if (this.phase === "moves_limit") {
            this._hide_chrome();
            return; // stop scheduling
        }

        window.requestAnimationFrame(function(t){ self.frame(t); });
    }
};
