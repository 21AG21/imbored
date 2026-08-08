# CUBICLE ARCADE 98

**The complete shareware collection for people whose meeting has no agenda.**

Twenty-seven games. Zero installers. No account, no network, no build step. It is plain
HTML, CSS and JavaScript, so you can **double-click `index.html`** and it runs straight
off the disk.

Comes with a panic key, a difficulty dial that reaches all the way to Nightmare, a big
screen mode, a colour-scheme picker, and a googly-eyed stapler called CHOMPS who has
nothing useful to say.

## Every game is doable

Nothing here can trap you or hand you an impossible board:

- **Sudoku** puzzles are dug out of a full solution one square at a time, and any dig that
  would allow a second answer is undone, so every board has exactly one solution reachable
  by pure logic.
- **Maze** is a *perfect maze* (one and only one path between any two cells), and there is
  a "Show path" button if you ever want the way out handed to you.
- **Jam Escape** and **Crate Pusher** levels were all solved by computer before shipping;
  Jam Escape even shows the provably shortest solution as par.
- **Pipe Dream** and **Lights Out** are built by scrambling a solved state, so a solution
  always exists.
- **Memory Match** literally cannot be lost.
- The action and simulation games had a fairness pass: mine density is capped where logic
  stops working, the Commute's conveyor boxes now cover enough of each belt that landing is
  never a coin-flip, Desk Toss keeps a makeable bin size, and the reaction games always
  leave you enough time to actually react.

Levels **auto-advance** on a short countdown when you finish, so you never have to reach
for the mouse between them. A "Stay here" button cancels it if you want a breather.

---

## The panic key

Press <kbd>`</kbd> (backtick) or <kbd>Ctrl</kbd>+<kbd>B</kbd> at any moment. The entire
page vanishes behind something that looks like work, the browser tab renames itself to
match, and whatever you were playing pauses exactly where it was. Press it again to go
back.

There are **five** disguises and you can type in all of them, which is the entire point.
A frozen screenshot fools nobody once somebody expects to see a cursor moving.

| Disguise | What you get |
|---|---|
| **Doc** | A close reproduction of Google Docs: the real chrome, the pill toolbar with drawn icons, the ruler, an 8.5in page with 1in margins, and Arial 11pt body text. Fully editable, caret already in place. |
| **Spreadsheet** | Every cell is editable and the formula bar tracks whatever cell you are in. |
| **Inbox** | A mail client with a folder list, a readable thread, and a reply box you can actually type a reply into. |
| **Terminal** | A build log that already passed 73 tests, plus a live prompt. Type a command, hit Enter, get a plausible answer. |
| **Any website** | Type any web address into the box in the footer and the panic key takes you there. Two modes, explained below. |

### Your own website as the panic screen

Put an address in the **PANIC SCREEN** box in the footer and pick how it opens:

- **Open the site** (default) navigates this tab straight to that address. This works with
  literally any website. Your scores live in `localStorage`, so the back button brings the
  arcade back exactly as you left it.
- **Embed it** drops the site into a frame on top of the games, so whatever you were
  playing stays paused underneath. This only works for sites that permit being framed, and
  most large sites explicitly forbid it with `X-Frame-Options` or a `frame-ancestors`
  policy. If you get a blank panel, that is why; switch to "Open the site".

Neither mode works in the hosted preview link, whose sandbox blocks all external hosts.
Run the local copy or your own hosted copy for this one.

## The difficulty dial

One button in the top bar, four settings, and **every game reads it**:

| | What changes |
|---|---|
| **Chill** | Slower spawns, kinder timers, a Four In A Row opponent that plays badly on purpose. |
| **Normal** | The way these were built. |
| **Hard** | Faster everything, fewer lives, five guesses in Word Guess, three-card draw in Solitaire, Tetris starts at level 4. |
| **Nightmare** | One life in Brick Break and Rock Field, four guesses, one Solitaire redeal, Tetris at level 7, and targets in Reflex Grid that get bored and leave. |

Changing it restarts whatever is running so it takes effect immediately.

## Big screen

The expand button or the <kbd>F</kbd> key hides all the furniture and blows the game up to fill
the window, requesting real browser fullscreen at the same time. <kbd>Esc</kbd> or
<kbd>F</kbd> again brings the shelf back.

## Colour scheme

Not a fan of the beige? The palette button in the top bar opens a picker with six presets
(the classic beige, cool slate, mint, rose, and two dark schemes) plus **a colour wheel
that builds a whole matching scheme from any single colour you pick**. The entire page is
driven by CSS variables, so a theme is genuinely just a set of overrides, dark schemes
included, and your choice is remembered.

---

## The games

### Simulations, where something is broken and you fix it

| | |
|---|---|
| **Gridlock** | The deep one. Twelve junctions across a full working day with a budget. Cars, buses that pull in at stops, slow trucks and ambulances that run reds and pay out if they arrive in time. Traffic direction swings inbound at the morning peak and outbound in the evening. Drag along a row for a green wave. Pedestrians only cross during the all-red, so leaving the lights alone is a losing strategy. Between days you spend the takings on smart signals, roundabouts, overpasses, wider roads, ambulance priority and a congestion heat map. |
| **Elevator Rush** | Three lifts, eight floors, and people who are already late. You decide who answers which call; passengers press their own buttons. |
| **Load Balance** | Hold a grid at 50 Hz through a full day. Coal ramps slowly, gas costs a fortune, and the weather does not consult you. |
| **Approach Control** | Draw flight paths on radar. Hold separation. Land each aircraft on its matching runway from the correct end. |

There is a companion piece worth ten minutes if Gridlock got its hooks in:
**[Phantom, a traffic jam with no cause at all](https://claude.ai/code/artifact/245d9555-fb6f-4685-b698-42a8f82c10bd)**.
One driver taps the brakes and the pulse outlives them, travelling backwards through the
traffic forever. It is linked from the shelf and from Gridlock itself.

### Puzzles
**Minesweeper** · **2048** · **Jam Escape** · **Crate Pusher** · **Pipe Dream** · **Solitaire** · **Maze**

### Brain
**Sudoku** · **Word Guess** · **Lights Out** · **Reflex Grid** · **Copycat** · **Four In A Row** · **Memory Match**

### Action
**Snake** · **Brick Break** · **Stacker** · **Rock Field** · **The Commute**

### Goofy
| | |
|---|---|
| **Coffee Clicker** | Click mug. Buy an intern to click the mug. Buy a robot to manage the intern. Saves automatically, which is a threat. |
| **Whack-a-Meeting** | Decline the junk invites before they book themselves in. The gold ones are payroll and your own review, so leave those alone. |
| **Desk Toss** | Crumpled paper, one bin, and an air conditioning vent with a personal grudge. Bin on a desk counts double. |
| **Desk Golf** | Nine holes across the carpet. Desks bounce, mousepads drag, somebody has spilled coffee everywhere. |

---

## Other keys

| Key | Does |
|---|---|
| <kbd>`</kbd> / <kbd>Ctrl</kbd>+<kbd>B</kbd> | panic screen |
| <kbd>F</kbd> | big screen |
| <kbd>/</kbd> | jump to search |
| <kbd>Esc</kbd> | back to the shelf |
| dice button | a game at random |
| speaker button | sound is **off** by default, because this is an office |

## On a phone

It is built for one, not merely tolerant of one.

- **Nothing ever scrolls sideways**, at any width down to 320px. Verified rather than assumed.
- **The playfield always fits the screen.** In landscape the layout measures its own chrome
  with flexbox and caps the canvas to whatever height is genuinely left, so no game sits
  below the fold. Boards built from DOM cells (Lights Out, 2048, Word Guess, Minesweeper)
  size themselves off the short side of the screen, not just the wide one.
- **Landscape strips the furniture** automatically: the brand, hints, ticker, footer and
  the how-to panel all step aside so the game gets the height.
- **Touch controls everywhere.** On-screen d-pads for Snake, Stacker, Crate Pusher, Rock
  Field and The Commute; swipe for 2048 and Snake; drag for Jam Escape, Solitaire, Desk
  Golf, Desk Toss, Approach Control and Gridlock; long-press to flag in Minesweeper. Every
  canvas sets `touch-action: none` so a drag on the game is never a page scroll.
- **Thumb-sized targets.** Buttons are at least 38px tall on phones.
- **Snake plays on a square board in portrait** instead of a letterbox strip, and asks you
  to swipe rather than to press a key you do not have.
- Safe-area insets for notched phones, `100svh` so the toolbar does not crop the layout,
  no pull-to-refresh mid-game, and a nudge on the wide simulations suggesting you turn the
  phone or hit expand.

Fullscreen is unavailable in Safari on iPhone, so the expand button falls back to hiding
the page chrome, which gets you most of the way there.

## Running it

- **Open the file.** Double-click `index.html`. Every script is a plain `<script>` tag, so
  there is no module or CORS problem loading from `file://`.
- **Serve it.** `python3 -m http.server 8000`, then visit `http://localhost:8000`.
- **One file.** `node tools/build-single-file.mjs` inlines everything into
  `dist/cubicle-arcade.html`, about 406 KB, no other assets — a complete
  standards-mode document (real doctype, meta viewport, favicon and all). Mail it
  to yourself, drop it on Google Drive, or paste the whole thing into an online
  HTML playground (OneCompiler, CodePen, JSFiddle).
- **Host it.** Any static host. A GitHub Pages workflow sits in
  `.github/workflows/pages.yml` and only runs when you start it from the Actions tab.

## How it is put together

```
index.html            loads everything, in order
css/arcade.css        the whole look
js/core/analytics.js  the one network call: Vercel page views, deployed hosts only
js/core/engine.js     canvas, loop, input, audio, DOM helper, disposer bag
js/core/icons.js      the drawn icon set (there are no emoji in this build)
js/core/themes.js     the colour-scheme presets and custom-colour builder
js/core/boss.js       the five panic screens
js/core/arcade.js     registry, router, shelf, scores, difficulty, CHOMPS
js/games/*.js         one file per game, each registering itself
tools/                the single-file bundler
```

A game is one self-contained file that calls `Arcade.register({...})` with its metadata
and a `mount(root, api)` function. `mount` returns a cleanup function which the router
calls on the way out, so nothing leaks between games. `api.dm` is the difficulty
multiplier every game scales its own knobs by. To add a game, drop a file in `js/games/`
and add one `<script>` tag.

Scores and progress live in `localStorage` under the `cubicle:` prefix. Your scores, your
settings and anything you type into a panic screen never leave the browser. The only
exception is the anonymous page-view ping described below, and only on a live deployment.

## A note on analytics

`js/core/analytics.js` wires up **Vercel Web Analytics**, and it is the single thing in the
build that touches the network. It is on a short leash:

- It **only wakes up on Vercel**. The insights script is served by Vercel's own edge, so it
  is allow-listed to hosts ending in `.vercel.app` (production, branch and preview deploys)
  and does nothing anywhere else — `file://`, `localhost`, **Google Drive / DriveToWeb**,
  GitHub Pages, the single-file bundle. Off Vercel it makes no request at all, so the "runs
  off the disk, nothing leaves the browser" promise holds and the console stays clean (no
  404 for a Vercel script that no Vercel is serving). A custom domain in front of a Vercel
  project can opt in with `window.__ARCADE_VERCEL__ = true`.
- It records **anonymous page views only**. No scores, no settings, and none of the text
  you type into a panic screen is ever sent.
- Collection still has to be switched on in the Vercel project: **Vercel dashboard →
  your project → Analytics → enable Web Analytics**. The code side is done; that toggle is
  the other half.

## Checked, not assumed

- All 24 games get loaded in headless Chromium, driven with keys, clicks and drags, left
  running, then checked for console errors and uncaught exceptions. 27 of 27 clean, on all
  four difficulty settings, and again in the single-file bundle.
- Mobile is checked at 390x844, 844x390 and 320x568: zero horizontal overflow on the shelf
  and in all 24 games, and zero playfields below the fold in landscape. Touch input is
  exercised with real tap and drag events on d-pads, boards and canvases.
- All four panic screens are opened and typed into by the test, and the typed text is read
  back out of the DOM to prove the keyboard reaches them.
- The 28 **Jam Escape** boards were generated by random placement plus a breadth-first
  solver, keeping only those with a shortest solution between 5 and 26 moves. The "par"
  shown in game is that exact search depth.
- The 13 **Crate Pusher** levels were hand-designed and then run through a solver. One
  candidate turned out to be genuinely unsolvable and was cut.
- **Pipe Dream** and **Lights Out** build every board by scrambling a solved one, so
  solvability is structural rather than tested.

## A note on the artwork

Every icon on the page is drawn as inline SVG in `js/core/icons.js`, and every graphic
inside a game is drawn with canvas primitives. There is not a single emoji in the build.

## A note on the spreadsheet

Every figure in the panic screens is invented. There is no real company, no real data, and
the numbers do not reconcile if anybody actually reads them. They exist to be boring from
three feet away, and that is all.
