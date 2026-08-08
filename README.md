# CUBICLE ARCADE 98

**The complete shareware collection for people whose meeting has no agenda.**

Twenty-four games. Zero installers. No account, no network, no build step. It is plain
HTML, CSS and JavaScript, so you can **double-click `index.html`** and it runs straight
off the disk.

Comes with a panic key, a difficulty dial that reaches all the way to Nightmare, a big
screen mode, and a googly-eyed stapler called CHOMPS who has nothing useful to say.

---

## The panic key

Press <kbd>`</kbd> (backtick) or <kbd>Ctrl</kbd>+<kbd>B</kbd> at any moment. The entire
page vanishes behind something that looks like work, the browser tab renames itself to
match, and whatever you were playing pauses exactly where it was. Press it again to go
back.

There are four disguises and **you can type in all of them**, which is the entire point.
A frozen screenshot fools nobody once somebody expects to see a cursor moving.

| Disguise | What you get |
|---|---|
| 📄 **Doc** | A word processor with a real editable document, a live word count and a "Saved to Drive" tick. Opens with the caret already in the text. |
| 📊 **Spreadsheet** | Every cell is editable and the formula bar tracks whatever cell you are in. |
| ✉️ **Inbox** | A mail client with a folder list, a readable thread, and a reply box you can actually type a reply into. |
| 💻 **Terminal** | A build log that already passed 73 tests, plus a live prompt. Type a command, hit Enter, get a plausible answer. |

Pick one from **PANIC SCREEN** in the footer, or shift-click the 🕴 button to cycle.

## The difficulty dial

One button in the top bar, four settings, and **every game reads it**:

| | What changes |
|---|---|
| 😌 **Chill** | Slower spawns, kinder timers, a Four In A Row opponent that plays badly on purpose. |
| 🙂 **Normal** | The way these were built. |
| 😰 **Hard** | Faster everything, fewer lives, five guesses in Word Guess, three-card draw in Solitaire, Tetris starts at level 4. |
| 💀 **Nightmare** | One life in Brick Break and Rock Field, four guesses, one Solitaire redeal, Tetris at level 7, and targets in Reflex Grid that get bored and leave. |

Changing it restarts whatever is running so it takes effect immediately.

## Big screen

The ⛶ button or the <kbd>F</kbd> key hides all the furniture and blows the game up to fill
the window, requesting real browser fullscreen at the same time. <kbd>Esc</kbd> or
<kbd>F</kbd> again brings the shelf back.

---

## The games

### Simulations, where something is broken and you fix it

| | |
|---|---|
| 🚦 **Gridlock** | Twelve intersections in rush hour. You are the lights. Cars route themselves, queue behind each other, and fill a commuter rage bar while they wait. |
| 🛗 **Elevator Rush** | Three lifts, eight floors, and people who are already late. You decide who answers which call; passengers press their own buttons. |
| ⚡ **Load Balance** | Hold a grid at 50 Hz through a full day. Coal ramps slowly, gas costs a fortune, and the weather does not consult you. |
| ✈️ **Approach Control** | Draw flight paths on radar. Hold separation. Land each aircraft on its matching runway from the correct end. |

There is a companion piece worth ten minutes if Gridlock got its hooks in:
**[Phantom, a traffic jam with no cause at all](https://claude.ai/code/artifact/245d9555-fb6f-4685-b698-42a8f82c10bd)**.
One driver taps the brakes and the pulse outlives them, travelling backwards through the
traffic forever. It is linked from the shelf and from Gridlock itself.

### Puzzles
💣 **Minesweeper** · 🔢 **2048** · 🚗 **Jam Escape** · 📦 **Crate Pusher** · 🔧 **Pipe Dream** · 🃏 **Solitaire**

### Brain
🔤 **Word Guess** · 💡 **Lights Out** · 🎯 **Reflex Grid** · 🎺 **Copycat** · 🔴 **Four In A Row**

### Action
🐍 **Snake** · 🧱 **Brick Break** · 🟦 **Stacker** · 🚀 **Rock Field** · 🚶 **The Commute**

### Goofy
| | |
|---|---|
| ☕ **Coffee Clicker** | Click mug. Buy an intern to click the mug. Buy a robot to manage the intern. Saves automatically, which is a threat. |
| 📅 **Whack-a-Meeting** | Decline the junk invites before they book themselves in. The gold ones are payroll and your own review, so leave those alone. |
| 🗑️ **Desk Toss** | Crumpled paper, one bin, and an air conditioning vent with a personal grudge. Bin on a desk counts double. |
| ⛳ **Desk Golf** | Nine holes across the carpet. Desks bounce, mousepads drag, somebody has spilled coffee everywhere. |

---

## Other keys

| Key | Does |
|---|---|
| <kbd>`</kbd> / <kbd>Ctrl</kbd>+<kbd>B</kbd> | panic screen |
| <kbd>F</kbd> | big screen |
| <kbd>/</kbd> | jump to search |
| <kbd>Esc</kbd> | back to the shelf |
| 🎲 | a game at random |
| 🔇 | sound is **off** by default, because this is an office |

## Running it

- **Open the file.** Double-click `index.html`. Every script is a plain `<script>` tag, so
  there is no module or CORS problem loading from `file://`.
- **Serve it.** `python3 -m http.server 8000`, then visit `http://localhost:8000`.
- **One file.** `node tools/build-single-file.mjs` inlines everything into
  `dist/cubicle-arcade.html`, about 300 KB, no other assets. Mail it to yourself.
- **Host it.** Any static host. A GitHub Pages workflow sits in
  `.github/workflows/pages.yml` and only runs when you start it from the Actions tab.

## How it is put together

```
index.html            loads everything, in order
css/arcade.css        the whole look
js/core/engine.js     canvas, loop, input, audio, DOM helper, disposer bag
js/core/boss.js       the four panic screens
js/core/arcade.js     registry, router, shelf, scores, difficulty, CHOMPS
js/games/*.js         one file per game, each registering itself
tools/                the single-file bundler
```

A game is one self-contained file that calls `Arcade.register({...})` with its metadata
and a `mount(root, api)` function. `mount` returns a cleanup function which the router
calls on the way out, so nothing leaks between games. `api.dm` is the difficulty
multiplier every game scales its own knobs by. To add a game, drop a file in `js/games/`
and add one `<script>` tag.

Scores and progress live in `localStorage` under the `cubicle:` prefix. Nothing leaves
the browser.

## Checked, not assumed

- All 24 games get loaded in headless Chromium, driven with keys, clicks and drags, left
  running, then checked for console errors and uncaught exceptions. 24 of 24 clean, on all
  four difficulty settings.
- All four panic screens are opened and typed into by the test, and the typed text is read
  back out of the DOM to prove the keyboard reaches them.
- The 28 **Jam Escape** boards were generated by random placement plus a breadth-first
  solver, keeping only those with a shortest solution between 5 and 26 moves. The "par"
  shown in game is that exact search depth.
- The 13 **Crate Pusher** levels were hand-designed and then run through a solver. One
  candidate turned out to be genuinely unsolvable and was cut.
- **Pipe Dream** and **Lights Out** build every board by scrambling a solved one, so
  solvability is structural rather than tested.

## A note on the spreadsheet

Every figure in the panic screens is invented. There is no real company, no real data, and
the numbers do not reconcile if anybody actually reads them. They exist to be boring from
three feet away, and that is all.
