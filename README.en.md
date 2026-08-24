# DnD Companion — web app (PWA)

A fully working app: character sheets, bestiary, items, custom content,
import/export. Opens in your phone's browser and installs on Android like
a regular app (home screen icon, works offline).

## How to open and install on Android

The files need to be hosted somewhere over https (service workers and PWA
installation require https or localhost — just double-clicking index.html
won't give you offline mode or an install button).

Easiest option — GitHub Pages:

1. Create a new GitHub repository and upload all the files from this folder
   (keeping the structure: index.html, manifest.json, sw.js, css/, js/, icons/).
2. In the repo settings, enable **Settings → Pages → Deploy from branch → main**.
3. In about a minute the site will be live at something like
   `https://YOUR_USERNAME.github.io/REPO_NAME/`.
4. Open that link on your phone in Chrome → menu (three dots) →
   **"Install app"** / **"Add to Home screen"**.

Alternatives: Netlify Drop (netlify.com/drop — just drag the folder in),
Vercel, Cloudflare Pages — any free static host will work.

## How to turn this into an .apk file

If you specifically need an .apk file (say, to distribute directly without
hosting it), there are ready-made tools that wrap a PWA into an apk:

- **PWABuilder** (pwabuilder.com) — paste in the link to your published site,
  it generates a signed .apk/.aab. The simplest way.
- **Bubblewrap** (Google, command-line tool) — same idea, but run locally.

## Project structure

```
index.html        — app markup
manifest.json      — metadata for installing as an app
sw.js               — offline caching
css/style.css       — styles
js/data.js          — starting data (races, classes, bestiary, items, spells)
js/app.js           — all the app logic
js/sounds.js        — synthesized sound effects (no external audio files)
js/books.js         — IndexedDB: rulebook PDFs and media avatars (video/GIF)
icons/              — app icons and the splash screen image
```

## Data and storage

Everything (characters, added creatures, items and spells, including
uploaded photos) is stored locally on the device (localStorage). The
**Settings → Import/Export** section lets you save everything into a single
.json file — for moving to another device or as a backup. Video and GIF
avatars (like the PDF rulebooks) are stored separately, in IndexedDB — they
aren't included in the .json export because of their size, and only carry
over together with the whole browser/profile.

## App features

- A character sheet following the official structure: ability scores, saving
  throws and skills with proficiency (checkboxes, proficiency bonus applied
  automatically), initiative and passive perception (auto-calculated), hit
  dice, death saves, inspiration, XP, attacks, proficiencies, coin purse
- The character sheet is split into 4 tabs under the header (Combat / Magic /
  Inventory / Info) with a smooth switching animation — no more endless
  scrolling mid-game
- Clicking a skill, saving throw, or attack on the character sheet instantly
  rolls the dice (d20 + modifier; for attacks — choose an attack roll or a
  damage roll) and shows the result as a popup card; the roll is added to the
  shared dice-roller history
- A full spell database with filters by level/class/school and search
- A bestiary with filters by type, challenge rating (CR), size, and habitat;
  creatures now have a subtype (e.g. "Humanoid (goblinoid)")
- An item catalog with filters by type and rarity; armor and weapons can be
  equipped — AC and attack bonus are calculated automatically
- A combat tracker: round counter, turn order by initiative, quick add for
  characters/creatures, HP tracking right during combat; tapping the HP
  number opens a damage/heal dialog for any amount (the +/- buttons next to
  it are still there for quick single-point adjustments)
- Creatures can know spells too — added and opened the same way as on a
  character sheet
- AC from armor is calculated correctly: light/medium/heavy armor factors in
  the Dexterity modifier differently, with flat bonuses (shields etc.)
  handled separately
- In long text fields you can bold, italicize, underline, and change the
  color and size (3 levels) of text — with a sound on every tap and the
  active formatting highlighted
- Text anchors: select a skill name and press "#" to mark it as an anchor —
  then jump straight to it via "🔍" instead of scrolling through a long list
- Text formatting is also available in the bestiary — for a creature's
  description and actions
- The icon palette has been greatly expanded: weather, nature, miscellaneous
- Bestiary: fly/swim/climb speed, skills, passive perception and languages
  for creatures
- Spell catalog: added the Artificer and Psion classes
- A "Books" section (📚 icon in the header) — upload your own rulebook PDFs,
  stored on the device; a built-in page-by-page viewer (pdf.js) with zoom,
  works offline after the first online open
- Avatars for characters, creatures, and items can be a photo, a GIF
  animation, or a video (MP4/WebM, up to 30 MB) — not just an emoji; GIFs and
  videos play right inside the avatar circle (muted, looping), photos are
  scaled with high-quality smoothing so they don't blur on high-DPI screens
- Each character can have its own name color
- 8 visual themes, each with its own thematic background pattern tiled
  across the whole app: a castle and dragon (Dark Fantasy), scrolls and a
  quill (Parchment), a moon and stars (Midnight), a cut gemstone (Emerald),
  skulls (Undead), a trident and flag (Ukraine), flames of varying intensity
  (Ember), clover leaves (Irish Clover)
- A decorative heading font (Cinzel), an HP bar, more "premium"-looking
  glowing cards
- 4 custom resource slots (Exhaustion, Ki points, item charges, etc.) — each
  with its own name and counter
- Spell slots by level (1–9) with a tracker for used/available, automatic
  calculation of spell save DC and spell attack bonus from the chosen
  spellcasting ability
- Add your own content (creatures/items/spells/races/classes)
- Built-in dice (d4–d100): a faceted 3D render with a choice of skin (ruby/
  gold/emerald/amethyst/obsidian), a large rolled number with small
  decorative numbers on the neighboring faces, a glow behind the die, a
  modifier stepper, advantage/disadvantage for d20, a wobbling roll
  animation, and a flash on a critical success/failure
- Ambient sounds for actions throughout the app (theme selection, tabs,
  filters, proficiency/equip checkboxes, saving and deleting, errors) — all
  sounds are synthesized right in the browser, no audio files, so it keeps
  working offline; can be switched off with a single toggle in Settings
- An animated splash screen on launch
- Import/export of everything into a single .json file
