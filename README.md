**EN** | [RU](README.ru.md)

# DnD Companion — web app (PWA)

A fully working app: character sheets, bestiary, items, custom content,
import/export. Opens in your phone's browser and installs on Android like
a regular app (home screen icon, works offline).

## How to open and install on Android

The files need to be hosted somewhere over https (the service worker and PWA
installation require https or localhost — just double-clicking index.html
won't give you offline mode or the install button).

The easiest option is GitHub Pages:

1. Create a new repository on GitHub and upload all the files from this
   folder (keeping the structure: index.html, manifest.json, sw.js, css/,
   js/, icons/).
2. In the repository settings, enable **Settings → Pages → Deploy from
   branch → main**.
3. After a minute the site will appear at an address like
   `https://YOUR_USERNAME.github.io/REPO_NAME/`.
4. Open that link on your phone in Chrome → menu (three dots) →
   **"Install app"** / **"Add to Home screen"**.

Alternatives: Netlify Drop (netlify.com/drop — just drag the folder in),
Vercel, Cloudflare Pages — any free static hosting works.

## How to turn this into an .apk file

If you specifically need an .apk file (e.g. to distribute directly, without
hosting), there are ready-made tools that wrap a PWA into an apk:

- **PWABuilder** (pwabuilder.com) — paste the link to your published site,
  it generates a signed .apk/.aab. The simplest option.
- **Bubblewrap** (Google, command-line tool) — the same thing, but locally.

## Project structure

```
index.html        — app markup
manifest.json      — metadata for installing as an app
sw.js               — offline caching
css/style.css       — styles
js/data.js          — starting data (races, classes, bestiary, items, spells)
js/app.js           — all the app logic
js/sounds.js        — synthesized sound effects (no external files)
icons/              — app icons and the splash-screen image
```

## Data and storage

Everything (characters, added creatures, items and spells, including
uploaded photos) is stored locally on the device (localStorage). The
**Settings → Import/Export** section lets you save everything into a single
.json file — for moving to another device or as a backup. Video and GIF
avatars (for characters, creatures and items), as well as PDF rulebooks,
are stored separately, in IndexedDB — they aren't included in the .json
export because of their size, and only carry over together with the whole
browser/profile.

## Updating the app

The app is a PWA with offline caching (`sw.js`), so after a new version is
published on the hosting, the phone may keep showing the old cached version
for a while. The sign of this: you know for sure there were changes, but
the app doesn't show them.

If a new version picks itself up in the background (while the tab was
open), the app shows a toast: "A new version is available — restart the
app" — just close and reopen the tab/PWA.

If that didn't happen, **Settings → App update** has a
**"🔄 Update app (clear cache)"** button — it unregisters the service
worker, completely wipes the app's cache and reloads the page, after which
the browser re-downloads everything from the server. This is the most
reliable way to force an update in one tap, without reinstalling the PWA.

Every time the files are edited, the cache version (`CACHE_NAME` in
`sw.js`) gets bumped — without that, the service worker won't notice
anything changed at all.

The service worker itself uses a "network, falling back to cache" strategy:
if the phone is online, every time you open the app it fetches the current
version of the site and updates the cache along the way; offline mode still
works through the saved copy. This should bring the "I opened it — no
changes" case down to almost zero.

### If the app is installed on Android via "Install" (WebAPK)

The way you added the site to your screen matters:
- **"Add to Home screen" as a plain shortcut** — opens the site in Chrome
  as a regular tab, updates get picked up like in the browser.
- **"Install app"** — Android wraps the site into a separate WebAPK with
  its own isolated storage. It has **its own, much less frequent update
  check cycle** (it may only check every few days) — this is a limitation
  of Android/Chrome itself, not of the app.

If, after installing this second way, the app is still stuck on an old
version, the fastest way to force a check:
1. Open `chrome://webapks` in Chrome's address bar, find the app in the
   list and tap "Check for update".
2. Or: Android Settings → Apps → find the installed app → Storage →
   "Clear cache" (or "Clear storage") → open the app from the home screen
   again.
3. Or reinstall: remove the icon from the home screen and open the site in
   Chrome again → "Install app".

## App features

- Character sheet following the official structure: ability scores, saving
  throws and skills with proficiency (checkboxes, proficiency bonus applied
  automatically), initiative and passive perception (auto-calculated), hit
  dice, death saves, inspiration, experience, attacks, proficiencies, purse
- A full spell database with filters by level/class/school and search
- Bestiary with filters by type, subtype, challenge rating (CR), size and
  habitat, plus search by name
- Item catalog with filters by type, subtype and rarity, plus search by
  name; armor and weapons can be equipped — AC and attack bonus are
  calculated automatically
- Combat tracker: round counter, initiative turn order, quick-add for
  characters/creatures, HP tracking right during combat
- Creatures can have spells too — added and opened the same way as on a
  character sheet
- AC from armor is calculated correctly: light/medium/heavy armor each
  handle the Dexterity modifier differently, and flat bonuses (shields
  etc.) are applied separately
- In long text fields you can bold, italicize, underline, and change color
  and size (3 levels) of selected text — with a sound on every tap and the
  active formatting highlighted
- Bookmarks in text: select a feature's name and press "#" to mark it as a
  bookmark — then jump straight to it via "🔍" instead of scrolling through
  the whole long list
- Text formatting is also available in the bestiary — for a creature's
  description and actions
- The icon palette has been significantly expanded: weather phenomena,
  nature, miscellaneous
- Bestiary: fly/swim/climb speed, skills, passive perception and languages
  for creatures
- Spell catalog: added the Artificer and Psion classes
- A "Books" section (📚 icon in the header) — upload your own PDF rulebooks,
  stored on the device; a built-in page-by-page viewer (pdf.js) with zoom,
  works offline after the first online open
- Avatars for characters, creatures and items can be a video (MP4/WebM) or
  an animated GIF (up to 30 MB), not just a static photo or emoji — plays
  right inside the avatar circle (silent, looping) everywhere it's shown:
  in lists, cards, the character sheet header
- Uploaded static photos (JPG/PNG/WebP) are automatically resized and
  compressed without losing sharpness on high-resolution screens; video and
  GIF are stored as-is, without re-encoding — so the animation doesn't
  degrade
- Creatures and items have a subtype — e.g. "Humanoid (goblinoid)" or
  "Armor (heavy)" — shown next to the type in the list and on the card,
  filterable via its own row of chips
- One-tap quick roll: clicking an ability score, saving throw, skill or
  attack on the character sheet immediately shows a popup with the d20 +
  modifier result (large) and the roll breakdown (small) — no need to go to
  a separate dice tab; the attack bonus automatically accounts for equipped
  gear
- Attack and damage rolls follow the D&D formula: to-hit — 1d20 + the
  modifier of the chosen ability (Strength/Dexterity/…) + proficiency bonus
  (if weapon proficiency is checked) + a flat bonus (magic weapon, feats) +
  the bonus from equipped gear; damage — the dice from the "Damage &
  effect" field + the same ability (without the proficiency bonus — that
  only applies to the to-hit roll, per the rules). A separate 🎲 button on
  an attack rolls only the damage; clicking the attack itself rolls only
  the to-hit
- The character sheet is split into tabs — Combat, Magic, Inventory, Info —
  instead of one long list; the header with name, race, class and level is
  always visible at the top, the tabs switch everything else
- Each character can have their own name color
- 8 visual themes: Dark Fantasy, Parchment, Midnight, Emerald, Undead,
  Ukraine (blue-and-yellow), warm "Ember", and "Irish Clover" — with a
  clover-leaf pattern tiled across the whole screen in every section
- A decorative font for headings (Cinzel), an HP bar, more "premium"-looking
  cards with a glow effect
- 4 slots for special resources (Exhaustion, Ki points, item charges, etc.)
  — each with its own name and counter
- Spell slots by level (1–9) with a tracker for used/available, automatic
  calculation of spell save DC and spell attack bonus from the chosen
  casting ability
- Add your own content (creatures/items/spells/races/classes)
- Built-in dice (d4–d100): SVG rendering with a choice of skin
  (ruby/gold/emerald/amethyst/obsidian), decorative neighboring faces on
  d20/d100, a glow behind the die, a modifier stepper, advantage/disadvantage
  for d20, a roll animation with wobble, a flash on a critical hit/miss
- Ambient sounds, an animated splash screen on launch
- Import/export of all content into a single .json file
- A button to force-update the app (clear the PWA cache) in Settings
- Skill proficiency can be raised to Expertise (double proficiency bonus) —
  clicking a skill's circle cycles empty → proficient (✓) → expertise (★)
- A "Trinkets & notes" block in the Inventory tab — free-form text for
  small odds and ends you don't want to set up as separate items
- Items can grant an ability score bonus (e.g. a ring of +2 Strength) —
  configured in the item form, applies while the item is equipped, and is
  factored into every relevant calculation (checks, saves, skills, AC,
  spellcasting, attacks) rather than just being shown for reference
