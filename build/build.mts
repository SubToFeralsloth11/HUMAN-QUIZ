/**
 * Builds THE HUMAN QUIZ from game/project.json (the quiz as made in the
 * StickWIX editor) plus the additions below, then exports it with the
 * StickWIX engine:
 *   index.html             the playable single-file game
 *   human-quiz.stickwix    the project file, to open it again in the editor
 *
 * Run: pnpm --dir "$STICKWIX" exec tsx "$PWD/build/build.mts"
 * (STICKWIX defaults to ~/Code/StickWIX-wt; its player template must be built.)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = process.env.STICKWIX ?? join(homedir(), 'Code/StickWIX-wt');

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------- ids already in the editor project ----------
const MENU = 'snmhc1i1z36';
const DONE = 'vqeoz6llnza'; // 0 while a level is undecided, 1 once passed or failed
const STEP = 'v89oseznmg0';
const CLICKS = 'vnxhxi625ok';
const BUTTON_KIND = 'kezqwe7wwkf';

// ---------- new values ----------
const REACHED = 'vhqreached';
const MISTAKES = 'vhqmistakes';
const RANK = 'vhqrank';

const SFX_RIGHT = 'builtin:sfx/coin';
const SFX_WRONG = 'builtin:sfx/error';
const SFX_WIN = 'builtin:sfx/win';

// ---------- small builders ----------
const lit = (v: number | string | boolean) => ({ lit: v });
const val = (id: string) => ({ valueId: id });
const set = (id: string, v: number | string) => ({ type: 'changeValue', value: val(id), op: 'set', amount: lit(v) });
const add = (id: string, n: number) => ({ type: 'changeValue', value: val(id), op: 'add', amount: lit(n) });
const is = (id: string, op: string, v: number | string) => ({ type: 'compare', value: val(id), op, to: lit(v) });
const undecided = () => is(DONE, 'eq', 0);
const goTo = (sceneId: string) => ({ type: 'changeScene', sceneId });
const sound = (assetId: string) => ({ type: 'playSound', assetId });
const say = (text: string, seconds = 1.5) => ({ type: 'showText', text, seconds: lit(seconds) });
const wait = (seconds: number) => ({ type: 'wait', seconds: lit(seconds) });
const ui = (t: string) => ({ t: 'ui', id: t });
const clicked = (target: J) => ({ type: 'clicked', target: typeof target === 'string' ? ui(target) : target });
const show = (id: string) => ({ type: 'show', target: ui(id) });
const hide = (id: string) => ({ type: 'hide', target: ui(id) });

let ruleSeq = 0;
const rule = (trigger: J, actions: J[], items: J[] = []) => ({
  id: `rhq${(ruleSeq++).toString(36)}`,
  enabled: true,
  trigger,
  conditions: { join: 'all', items },
  actions,
});

function el(id: string, type: 'text' | 'button', x: number, y: number, text: string, size = 24, extra: J = {}) {
  return { id, name: extra.name ?? id, type, x, y, anchor: extra.anchor ?? 'tl', text, style: { size, color: extra.color ?? '#ffffff', font: extra.font ?? 'round' }, hidden: extra.hidden ?? false };
}
/** Left x that centres a button of this text on `cx` (same width estimate as the engine). */
const centred = (text: string, size: number, cx = 240) => Math.round(cx - (text.length * size * 0.58 + 32) / 2);

/** Wrong answer: count it, buzz, taunt, back to the menu. */
const fail = (text: string) => [set(DONE, 1), add(MISTAKES, 1), sound(SFX_WRONG), say(text), wait(1.5), goTo(MENU)];
const pass = (sceneId: string) => [set(DONE, 1), sound(SFX_RIGHT), goTo(sceneId)];

function scene(id: string, name: string, ui: J[], rules: J[], extra: J = {}) {
  return {
    id,
    name,
    width: 480,
    height: 640,
    background: { color: extra.bg ?? '#f5f5f5' },
    tileLayer: { tileSetId: null, cellSize: 32, cells: {} },
    objects: extra.objects ?? [],
    ui,
    rules,
  };
}

const levelTitle = (id: string, label: string) => el(id, 'text', 16, 16, label, 38, { name: 'Level', anchor: 't', font: 'bold' });

// ---------- load ----------
const project: J = JSON.parse(await readFile(join(ROOT, 'game/project.json'), 'utf8'));
const byName = (name: string) => {
  const s = project.scenes.find((x: J) => x.name === name);
  if (!s) throw new Error(`No scene called ${name}`);
  return s;
};
const ORIGINAL_FINAL = byName('Level 50');
const COOKIE = byName('Level');

project.values.push(
  { id: REACHED, name: 'Reached', scope: 'game', type: 'number', start: 1, min: 1, remember: true },
  { id: MISTAKES, name: 'Mistakes', scope: 'game', type: 'number', start: 0, remember: true },
  { id: RANK, name: 'Rank', scope: 'game', type: 'text', start: 'Human', remember: false },
);

// ---------- 1. varied taunts on "Type HI" ----------
const HI_TAUNTS = [
  '{L}? Bold choice.',
  'Did {L} look like an H?',
  '{L}. Two letters. H and I.',
  '{L}? Your keyboard is crying.',
  'H-I. Not {L}-anything.',
  '{L}?! Spelling bee reject.',
  'That is {L}. Points for confidence.',
  '{L}... are you typing with your elbow?',
  'So close! (Not really. That was {L}.)',
];
{
  let i = 0;
  for (const r of byName('Level 26').rules)
    for (const a of r.actions) {
      const m = a.type === 'showText' && /^([A-Z])\? Can't spell HI\?$/.exec(a.text);
      if (m) a.text = HI_TAUNTS[i++ % HI_TAUNTS.length]!.replace('{L}', m[1]!);
    }
}

// ---------- 2. bigger tap spot for the "A" in APPLE (phones) ----------
{
  const a = byName('Level 21').objects.find((o: J) => o.id === 'ogomstaf5gv');
  Object.assign(a, { x: 64, y: 206, scaleX: 1.2, scaleY: 1.4 });
}

// ---------- 3. callback levels and new input types (inserted before the final level) ----------
const L = (n: number) => `shq${n}`;
const NEW_FIRST = 50;
const FINAL_N = 55;
const BOSS = 'shqboss';
const CERT = 'shqcert';
const SELECT = 'shqselect';
const nextOf = (n: number) => (n === FINAL_N - 1 ? ORIGINAL_FINAL.id : L(n + 1));

const newLevels: J[] = [];

// 50: callback to 13, longer
{
  const n = 50, id = L(n);
  newLevels.push(
    scene(id, `Level ${n}`, [
      levelTitle(`${id}t`, `Level ${n}`),
      el(`${id}a`, 'text', 30, 170, 'Remember level 13?', 24),
      el(`${id}b`, 'text', 30, 205, "Same rule. Don't touch.", 24),
      el(`${id}c`, 'text', 30, 240, '8 seconds this time.', 18),
      el(`${id}d`, 'button', 40, 320, 'I remember!', 24),
      el(`${id}e`, 'button', 270, 320, 'Skip', 24),
      el(`${id}f`, 'button', centred('Tap for a hint', 20), 440, 'Tap for a hint', 20),
    ], [
      rule({ type: 'clicked', target: ui(`${id}d`) }, fail('Clearly you did not'), [undecided()]),
      rule({ type: 'clicked', target: ui(`${id}e`) }, fail('Skipping is touching'), [undecided()]),
      rule({ type: 'clicked', target: ui(`${id}f`) }, fail('The hint was: no touching'), [undecided()]),
      rule({ type: 'after', seconds: lit(8) }, [set(DONE, 1), sound(SFX_RIGHT), say('Statue mode: unlocked'), wait(1.5), goTo(nextOf(n))], [undecided()]),
    ]),
  );
}
// 51: callback to 10/17, the title lies
{
  const n = 51, id = L(n);
  newLevels.push(
    scene(id, `Level ${n}`, [
      levelTitle(`${id}t`, 'Level 17'),
      el(`${id}a`, 'text', 30, 190, 'What level is this?', 24),
      el(`${id}b`, 'text', 30, 225, '(you have seen this one)', 16),
      el(`${id}c`, 'button', 70, 320, '17', 24),
      el(`${id}d`, 'button', 200, 320, '10', 24),
      el(`${id}e`, 'button', 330, 320, '51', 24),
    ], [
      rule(clicked(`${id}c`), fail('The title lies. Count.'), [undecided()]),
      rule(clicked(`${id}d`), fail('That was ages ago'), [undecided()]),
      rule(clicked(`${id}e`), pass(nextOf(n)), [undecided()]),
    ]),
  );
}
// 52: callback to 22, this time "Next" is real and the dot is the trap
{
  const n = 52, id = L(n);
  newLevels.push(
    scene(id, `Level ${n}`, [
      levelTitle(`${id}t`, `Level ${n}`),
      el(`${id}a`, 'text', 30, 190, 'LEVEL COMPLETE!', 24),
      el(`${id}b`, 'text', 30, 225, '(for real this time)', 16),
      el(`${id}c`, 'button', 180, 300, 'Next >', 24),
      el(`${id}d`, 'text', 30, 400, 'jk. click the dot', 24, { hidden: true }),
      el(`${id}e`, 'button', 420, 600, '.', 24, { hidden: true }),
    ], [
      rule({ type: 'after', seconds: lit(2) }, [show(`${id}d`), show(`${id}e`)]),
      rule(clicked(`${id}c`), pass(nextOf(n)), [undecided()]),
      rule(clicked(`${id}e`), fail('Fool me once...'), [undecided()]),
    ]),
  );
}
// 53: new input: a moving target
const COIN_KIND = 'khqcoin';
project.kinds.push({ id: COIN_KIND, name: 'Runaway coin', lookId: 'builtin:img/coin', size: { w: 64, h: 64 }, stickers: [], values: [], rules: [], layer: 0 });
{
  const n = 53, id = L(n), coin = `${id}coin`;
  const spots = [[208, 300], [60, 470], [360, 200], [90, 160], [340, 500], [220, 420]];
  const hops = spots.map(([x, y], i) =>
    rule({ type: 'every', seconds: lit(0.8) }, [{ type: 'moveTo', target: { t: 'object', id: coin }, to: { at: { x: lit(x!), y: lit(y!) } } }, set(STEP, (i + 1) % spots.length)], [is(STEP, 'eq', i)]),
  );
  newLevels.push(
    scene(id, `Level ${n}`, [
      levelTitle(`${id}t`, `Level ${n}`),
      el(`${id}a`, 'text', 30, 90, 'Grab the coin 5 times', 24),
      el(`${id}b`, 'text', 200, 125, '{Clicks}/5', 24),
    ], [
      rule({ type: 'sceneStart' }, [set(CLICKS, 0), set(STEP, 0)]),
      ...hops,
      rule(clicked({ t: 'object', id: coin }), [add(CLICKS, 1), sound('builtin:sfx/click'), { type: 'moveTo', target: { t: 'object', id: coin }, to: { at: { x: lit(400), y: lit(560) } } }]),
      rule({ type: 'valueReaches', value: val(CLICKS), amount: lit(5) }, pass(nextOf(n)), [undecided()]),
    ], { objects: [{ id: coin, kindId: COIN_KIND, x: 208, y: 300, rotation: 0, scaleX: 1, scaleY: 1, layer: 0, overrides: {} }] }),
  );
}
// 54: new input: memory sequence
{
  const n = 54, id = L(n);
  const order = [3, 1, 4, 2];
  const pads = [1, 2, 3, 4].map((k, i) => el(`${id}p${k}`, 'button', 60 + i * 95, 360, String(k), 30));
  // Rules run in list order within one tap, so later positions come first: a correct tap's
  // "Step + 1" must not make the next position's rule match the same tap.
  const press = [1, 2, 3, 4].flatMap((k) =>
    order
      .map((want, pos) => rule(clicked(`${id}p${k}`), want === k ? [add(STEP, 1), sound('builtin:sfx/click')] : fail('Goldfish memory'), [undecided(), is(STEP, 'eq', pos)]))
      .reverse(),
  );
  newLevels.push(
    scene(id, `Level ${n}`, [
      levelTitle(`${id}t`, `Level ${n}`),
      el(`${id}a`, 'text', 30, 150, 'Remember this:', 24),
      el(`${id}b`, 'text', 150, 210, order.join('  '), 48, { font: 'bold' }),
      el(`${id}c`, 'text', 30, 290, 'Now tap it in order', 24, { hidden: true }),
      el(`${id}d`, 'text', 210, 450, '{Step}/4', 24),
      ...pads.map((p) => ({ ...p, hidden: true })),
    ], [
      rule({ type: 'sceneStart' }, [set(STEP, 0)]),
      rule({ type: 'after', seconds: lit(2.5) }, [hide(`${id}b`), hide(`${id}a`), show(`${id}c`), ...pads.map((p) => show(p.id))]),
      ...press,
      rule({ type: 'valueReaches', value: val(STEP), amount: lit(4) }, pass(nextOf(n)), [undecided()]),
    ]),
  );
}

// The old last level now leads here; L49 now leads to the first new level.
for (const r of byName('Level 49').rules)
  for (const a of r.actions) if (a.type === 'changeScene' && a.sceneId === ORIGINAL_FINAL.id) a.sceneId = L(NEW_FIRST);
ORIGINAL_FINAL.name = `Level ${FINAL_N}`;
ORIGINAL_FINAL.ui.find((u: J) => u.text === 'Level 50').text = `Level ${FINAL_N}`;
for (const r of ORIGINAL_FINAL.rules) for (const a of r.actions) if (a.type === 'changeScene' && a.sceneId === COOKIE.id) a.sceneId = BOSS;

// ---------- 4. final boss: the CAPTCHA ----------
{
  const id = BOSS;
  const box = [[40, 300], [280, 130], [60, 520], [300, 470]] as const;
  const boxes = box.map(([x, y], i) => el(`${id}x${i}`, 'button', x, y, "[ ] I'm not a robot", 22, { hidden: i > 0 }));
  const grid = ['TOASTER', 'ROBOT', 'CAT', 'LAMP', 'A BOT', 'CLOUD', 'SPOON', 'MIRROR', 'DOG'];
  const cells = grid.map((w, i) => el(`${id}g${i}`, 'button', 22 + (i % 3) * 150, 230 + Math.floor(i / 3) * 70, w, 18, { hidden: true }));
  const jokes = ['That is a toaster.', 'Literally says ROBOT.', 'Cats are not humans. Yet.', 'A lamp. Bright idea though.', 'A BOT. Read it again.', 'Cloud. Not even solid.', 'Spoon? Really?', 'Wait. Who is in the mirror?', 'Good boy. Not a human.'];
  newLevels.push(
    scene(id, 'Final boss', [
      el(`${id}t`, 'text', 16, 16, 'FINAL BOSS', 38, { name: 'Level', anchor: 't', font: 'bold', color: '#ff7a59' }),
      el(`${id}a`, 'text', 30, 80, 'Plot twist: one more.', 22),
      el(`${id}b`, 'text', 30, 112, 'Prove you are human.', 22),
      ...boxes,
      el(`${id}c`, 'text', 30, 160, 'Select ALL squares', 22, { hidden: true }),
      el(`${id}d`, 'text', 30, 190, 'with HUMANS in them', 22, { hidden: true }),
      ...cells,
      el(`${id}v`, 'button', centred('VERIFY', 26), 470, 'VERIFY', 26, { hidden: true }),
      el(`${id}w`, 'text', 30, 560, 'Verifying...', 24, { hidden: true }),
    ], [
      rule({ type: 'sceneStart' }, [set(STEP, 0)]),
      ...boxes.slice(0, -1).map((b, i) => rule(clicked(b.id), [hide(b.id), show(boxes[i + 1]!.id), say(['Nope', 'Too slow', 'Almost!'][i]!, 0.8)])),
      rule(clicked(boxes.at(-1)!.id), [hide(boxes.at(-1)!.id), hide(`${id}a`), hide(`${id}b`), show(`${id}c`), show(`${id}d`), ...cells.map((c) => show(c.id)), show(`${id}v`), set(STEP, 1)]),
      ...cells.map((c, i) => rule(clicked(c.id), fail(jokes[i]!), [undecided(), is(STEP, 'eq', 1)])),
      rule(clicked(`${id}v`), [set(DONE, 1), show(`${id}w`), wait(2), sound(SFX_WIN), goTo(CERT)], [undecided(), is(STEP, 'eq', 1)]),
    ]),
  );
}

// ---------- 5. the certificate ----------
const RANKS: [string, J[]][] = [
  ['Flawless. Suspiciously flawless.', [is(MISTAKES, 'eq', 0)]],
  ['Certified human', [is(MISTAKES, 'ge', 1), is(MISTAKES, 'le', 15)]],
  ['Mostly human', [is(MISTAKES, 'ge', 16), is(MISTAKES, 'le', 40)]],
  ["Human-ish. We'll allow it.", [is(MISTAKES, 'ge', 41)]],
];
const SHARE_TEXT = 'I passed THE HUMAN QUIZ (56 levels)! Mistakes: {Mistakes}. Rank: {Rank}. Are you human?';
newLevels.push(
  scene(CERT, 'Certificate', [
    el(`${CERT}a`, 'text', 0, 70, 'HUMAN VERIFIED', 40, { anchor: 't', font: 'bold', color: '#7bd88f' }),
    el(`${CERT}b`, 'text', 0, 140, 'This certifies that YOU', 22, { anchor: 't' }),
    el(`${CERT}c`, 'text', 0, 172, 'beat all 56 levels', 22, { anchor: 't' }),
    el(`${CERT}d`, 'text', 0, 240, 'Mistakes: {Mistakes}', 30, { anchor: 't', font: 'bold' }),
    el(`${CERT}e`, 'text', 0, 290, 'Rank: {Rank}', 20, { anchor: 't' }),
    el(`${CERT}f`, 'text', 0, 330, 'Fewer than 15 = certified human', 16, { anchor: 't' }),
    el(`${CERT}s`, 'button', centred('Share my score', 26), 390, 'Share my score', 26),
    el(`${CERT}k`, 'button', centred('Claim your cookie', 22), 470, 'Claim your cookie', 22),
    el(`${CERT}m`, 'button', centred('Menu', 22), 545, 'Menu', 22),
  ], [
    ...RANKS.map(([text, when]) => rule({ type: 'sceneStart' }, [set(RANK, text)], when)),
    rule(clicked(`${CERT}s`), [{ type: 'share', text: SHARE_TEXT }]),
    rule(clicked(`${CERT}k`), [goTo(COOKIE.id)]),
    rule(clicked(`${CERT}m`), [goTo(MENU)]),
  ]),
);

COOKIE.name = 'Cookie bonus';
COOKIE.ui.find((u: J) => u.text === 'You beat all 50 levels!').text = 'Bonus: click the cookie';
COOKIE.ui.push(el('uhqcookiemenu', 'button', 380, 590, 'Menu', 22));
COOKIE.rules.push(rule(clicked('uhqcookiemenu'), [goTo(MENU)]));

// Insert the new scenes after Level 49 so the editor's scene list reads in play order.
{
  const at = project.scenes.indexOf(byName('Level 49')) + 1;
  project.scenes.splice(at, 0, ...newLevels.filter((s) => s.id.startsWith('shq') && /^shq\d+$/.test(s.id)));
  const fin = project.scenes.indexOf(ORIGINAL_FINAL) + 1;
  project.scenes.splice(fin, 0, ...newLevels.filter((s) => s.id === BOSS || s.id === CERT));
}

// ---------- 6. every level: sounds, mistakes, saved progress, mistake counter ----------
const levels: J[] = [...Array(FINAL_N).keys()].map((i) => byName(`Level ${i + 1}`)).concat([byName('Final boss')]);
const LAST = levels.length; // 56
const levelIds = new Set(levels.map((s) => s.id).concat(CERT));
levels.forEach((s, i) => {
  const n = i + 1;
  for (const r of s.rules) {
    const acts: J[] = r.actions;
    const toMenu = acts.some((a) => a.type === 'changeScene' && a.sceneId === MENU);
    const onward = acts.some((a) => a.type === 'changeScene' && levelIds.has(a.sceneId));
    const wrongOrder = acts.some((a) => a.type === 'showText' && /^Wrong order/.test(a.text));
    const counted = acts.some((a) => a.type === 'changeValue' && a.value.valueId === MISTAKES);
    if ((toMenu || wrongOrder) && !counted) {
      const at = acts.findIndex((a) => a.type === 'showText');
      acts.splice(Math.max(0, at), 0, add(MISTAKES, 1), sound(SFX_WRONG));
    } else if (onward && !acts.some((a) => a.type === 'playSound')) {
      acts.splice(acts.findIndex((a) => a.type === 'changeScene'), 0, sound(SFX_RIGHT));
    }
  }
  s.rules.unshift(rule({ type: 'sceneStart' }, [set(REACHED, n)], [is(REACHED, 'lt', n)]));
  const resets = s.rules.some((r: J) => r.trigger.type === 'sceneStart' && r.actions.some((a: J) => a.type === 'changeValue' && a.value.valueId === DONE));
  if (!resets) s.rules.unshift(rule({ type: 'sceneStart' }, [set(DONE, 0)]));
  s.ui.push(el(`uhqmist${n}`, 'text', 8, 616, 'Mistakes: {Mistakes}', 14, { name: 'Mistake counter' }));
});

// ---------- 7. menu: continue, level select, start over ----------
{
  const menu = byName('Menu');
  const old = menu.ui.find((u: J) => u.text === 'PLAY');
  menu.rules = menu.rules.filter((r: J) => !(r.trigger.type === 'clicked' && r.trigger.target.id === old.id));
  menu.ui = menu.ui.filter((u: J) => u !== old);
  menu.ui.push(
    el('uhqplay', 'button', centred('PLAY', 32), 250, 'PLAY', 32, { font: 'bold' }),
    el('uhqat', 'text', 0, 316, 'Level {Reached}', 20, { anchor: 't' }),
    el('uhqselect', 'button', centred('Level select', 22), 370, 'Level select', 22),
    el('uhqover', 'button', centred('Start over', 22), 440, 'Start over', 22),
    el('uhqmist', 'text', 0, 530, 'Mistakes: {Mistakes}', 20, { anchor: 't' }),
    el('uhqgoal', 'text', 0, 560, 'Finish with under 15 to be certified human', 14, { anchor: 't' }),
  );
  menu.rules.push(
    ...levels.map((s, i) => rule(clicked('uhqplay'), [sound('builtin:sfx/click'), goTo(s.id)], [is(REACHED, 'eq', i + 1)])),
    rule(clicked('uhqplay'), [goTo(levels[0].id)], [is(REACHED, 'gt', LAST)]),
    rule(clicked('uhqselect'), [goTo(SELECT)]),
    rule(clicked('uhqover'), [set(MISTAKES, 0), goTo(levels[0].id)]),
  );
}
{
  const COLS = 7, CW = 64, RH = 56, X0 = 16, Y0 = 96, SIZE = 20;
  const items: J[] = [];
  const rules: J[] = [];
  levels.forEach((s, i) => {
    const n = i + 1, label = n === LAST ? 'B' : String(n);
    const cx = X0 + (i % COLS) * CW + CW / 2, y = Y0 + Math.floor(i / COLS) * RH;
    const btn = `uhqs${n}`, lock = `uhql${n}`;
    items.push(el(btn, 'button', centred(label, SIZE, cx), y, label, SIZE));
    items.push(el(lock, 'text', Math.round(cx - 6), y + 8, '-', SIZE, { hidden: true, color: '#9a98a6' }));
    rules.push(rule({ type: 'sceneStart' }, [hide(btn), show(lock)], [is(REACHED, 'lt', n)]));
    rules.push(rule(clicked(btn), [sound('builtin:sfx/click'), goTo(s.id)]));
  });
  project.scenes.splice(1, 0, scene(SELECT, 'Level select', [
    el('uhqsTitle', 'text', 0, 24, 'LEVEL SELECT', 34, { anchor: 't', font: 'bold' }),
    el('uhqsHint', 'text', 0, 64, 'B = final boss. Beat a level to unlock the next.', 13, { anchor: 't' }),
    ...items,
    el('uhqsBack', 'button', centred('Back', 22), 560, 'Back', 22),
  ], [...rules, rule(clicked('uhqsBack'), [goTo(MENU)])]));
}

// ---------- 8. smaller file: the tile sets were never painted ----------
project.tileSets = [];
for (const s of project.scenes) s.tileLayer = { tileSetId: null, cellSize: s.tileLayer.cellSize, cells: {} };

project.updatedAt = new Date().toISOString();

// ---------- validate and export ----------
// The engine lives in another checkout chosen by STICKWIX, so its modules are imported at run time.
const { Project } = await import(join(ENGINE, 'src/model/schema.ts'));
const { exportGame } = await import(join(ENGINE, 'src/export/export-game.ts'));
const { ruleStates } = await import(join(ENGINE, 'src/model/references.ts'));
const { exportProjectFile } = await import(join(ENGINE, 'src/storage/project-file.ts'));
const parsed = Project.parse(project);
for (const [ruleId, { state }] of ruleStates(parsed)) if (state !== 'ok') throw new Error(`Rule ${ruleId} is ${state}`);

const manifest = JSON.parse(await readFile(join(ENGINE, 'public/assets/builtin/manifest.json'), 'utf8'));
const builtinFile = (id: string): string | undefined => (manifest.images[id] ?? manifest.sounds[id] ?? manifest.tilesets[id])?.file;
const MIME: Record<string, string> = { png: 'image/png', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav' };
const blobOf = async (path: string) => new Blob([await readFile(path)], { type: MIME[path.split('.').pop()!] });
const ownAsset = (id: string) => blobOf(join(ROOT, 'game/assets', `${id}.png`));

const html: string = await exportGame(parsed, {
  template: await readFile(join(ENGINE, 'public/player-template.html'), 'utf8'),
  manifest,
  builtinUrl: (id: string) => {
    const file = builtinFile(id);
    return file ? join(ENGINE, 'public/assets/builtin', file) : undefined;
  },
  loadAsset: ownAsset,
  fetch: (async (path: string) => new Response(await blobOf(path))) as typeof fetch,
});
await writeFile(join(ROOT, 'index.html'), html);

const zip: Blob = await exportProjectFile(parsed, ownAsset);
await writeFile(join(ROOT, 'human-quiz.stickwix'), new Uint8Array(await zip.arrayBuffer()));

console.log(`index.html ${(html.length / 1024).toFixed(0)} KB, ${parsed.scenes.length} scenes, ${LAST} levels`);
