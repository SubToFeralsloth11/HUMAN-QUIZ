# HUMAN-QUIZ
its a quiz all humans should be able to finish

56 trick levels made with the StickWIX engine. Plays on phones (tap only) and desktop. Progress and mistakes are saved in the browser.

## Files

| File | What it is |
|---|---|
| `index.html` | The game. Open it or host it anywhere. |
| `human-quiz.stickwix` | The project. Import it in the StickWIX editor to edit the levels. |
| `game/project.json`, `game/assets/` | The quiz as made in the editor (levels 1-50 and the cookie bonus). |
| `build/build.mts` | Adds the rest and exports both files above. |

`build.mts` adds: saved progress with Continue, level select, mistake counter and rank, right/wrong sounds, varied "Type HI" taunts, levels 50-54 (three callbacks and two new kinds of input), the CAPTCHA final boss, the certificate with a share button, and a bigger tap spot on the APPLE level.

## Build

Needs a StickWIX checkout with its player built (`pnpm build:player`), at `~/Code/StickWIX-wt` or in `STICKWIX`:

```sh
pnpm --dir ~/Code/StickWIX-wt exec tsx "$PWD/build/build.mts"
```
