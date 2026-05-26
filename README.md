# Knights Spiral

A spiral-board painting game for up to 7 chess pieces. Each piece takes
turns scanning spiral indices outward from center, claiming the lowest
legal square — one not occupied, not already painted, and not attackable
by any opponent-colored square. The board grows dynamically until deadlock
or the board cap is reached.

Open `knights_spiral.html` directly in a browser (including `file://`).
No build step, no dependencies, no network calls.

## Piece types

| Type      | Move style                      |
|-----------|---------------------------------|
| knight    | (2,1)-leaper, 8 offsets         |
| rook      | slider along ranks/files        |
| bishop    | slider along diagonals          |
| camel     | (3,1)-leaper, 8 offsets         |
| zebra     | (3,2)-leaper, 8 offsets         |
| giraffe   | (4,1)-leaper, 8 offsets         |
| antelope  | (4,3)-leaper, 8 offsets         |

Sliders are blocked by any painted or occupied square (standard
line-of-sight). Jumpers attack fixed offsets regardless of intervening
squares.

## URL parameters

| Param    | Example                   | Notes                                       |
|----------|---------------------------|---------------------------------------------|
| `pieces` | `knight,rook,bishop`      | Required; 1–7 items; defines turn order     |
| `start`  | `0,1,2`                   | Spiral start indices; count must match      |
| `colors` | `green,black,red`         | Optional; case-insensitive; no duplicates   |
| `moves`  | `5000`                    | Stop after N moves                          |
| `size`   | `1001`                    | Max board side (odd, 5–8001; default 4001)  |

Default with no params: `?pieces=knight,knight` (stranded mode).

Palette is fixed at 7 named colors: `BLACK`, `RED`, `BLUE`, `GREEN`,
`PURPLE`, `ORANGE`, `TEAL`. Rendering switches to pixel mode after
`PIXEL_THRESHOLD` moves (1 cell = 1 canvas pixel).

## Spiral numbering

Index 0 sits at the board center; 1 is one step east, then the sequence
wraps counter-clockwise outward in expanding rings. The authoritative
diagram lives in `knights_spiral.js` lines 34–40.

## Presets

`spirals.html` is a standalone gallery of curated `?pieces=…&start=…`
combos that link straight into the main app. Use it as the canonical
reference for known-good preset URLs.

## Headless rendering

`test/headless.js` (Node + `canvas`) renders configurations to PNG without a
browser. The `test/makefile` wires reproducible presets:

| Target                                               | Notes                              |
|------------------------------------------------------|------------------------------------|
| `make test`                                          | Build every preset PNG (from root) |
| `make -C test all`                                   | Same, run directly in test/        |
| `make -C test images/knight2-black-red-2001.png`     | Issue-1 reproducer                 |
| `make -C test images/knight2-default-1001.png`       | Default stranded mode, size 1001   |
| `make -C test images/knight3-trio-2001.png`          | Three knights at 0/1/2             |
| `make -C test images/rook2-blue-green-101.png`       | Pure sliders (slow path, size 101) |
| `make -C test images/bishop-knight-rook-101.png`     | Mixed pieces (slow path)           |
| `make -C test clean`                                 | Remove generated images            |

Sliders force a per-move `attacked_set()` rebuild, so any non-jumper
configuration is bounded to small board sizes.

## Files

| File                  | 🧿 | Description                                            |
|-----------------------|----|--------------------------------------------------------|
| folder.jpg            | 🖼️ | Folder thumbnail image                                 |
| knights_spiral.html   | 🌐 | App entrypoint — loads JS, wires buttons, URL contract |
| knights_spiral.js     | 🥨 | All app logic — single global `knights_spiral` object  |
| makefile              | 🚂 | Repo plumbing (jwk, github-push) + test pass-through   |
| spirals.html          | 🌐 | Gallery of preset combos; links into the main app      |
| test/                 | 📁 | Headless image-regression harness (Node + canvas)      |

[.htaccess DirectoryIndex spirals.html ]: #
[# vim: set ft=markdown ts=2 sw=2 sts=2 et : ]: #
