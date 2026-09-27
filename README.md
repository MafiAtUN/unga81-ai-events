# The week AI took the floor: AI at UNGA81

Live at https://mafiatun.github.io/unga81-ai-events/

133 UN linked events, sessions and launches on AI around the 81st session of the UN General Assembly, and the General Debate statements that mentioned AI. Compiled by Mafizul Islam from public UN, organiser and media listings. Personal analysis, not an official UN publication.

## Before publishing (author checklist)

1. Check each General Debate entry against the official statement on gadebate.un.org, set `statement_url` and `verified: true`. Seats with `verified: false` render with a dotted outline and the caption notes pending verification.
2. Read every `ai_gist` and every `detail` line once.
3. Confirm organiser names for the milestone items.
4. Update the as at date.

Also before launch:

- Review every country page under `/country/{slug}/` (acceptance check 12).
- Replace `public/og/cover.png` (1200 x 627) and `public/og/cover-4x5.png` with your own crops of the infographic. The files in the repository are provisional crops made from the infographic.
- Check the home page, one item page and one country page in the LinkedIn Post Inspector (acceptance check 9).

## Data

The data lives in `src/data`:

- `events.json`: 133 items
- `debate.json`: 143 General Debate statements
- `meta.json`: as at date, labels, colours, method note and verified quotes

These files were extracted byte for byte from the appendices of the build brief with `node scripts/extract-data.mjs "UNGA81 AI site build brief.md"`. Never retype data by hand.

When the data changes (for example after the General Debate closes on 28 September), edit the JSON and the expected counts in `scripts/validate.mjs` together. The validator fails the build if any count differs, if an `ai_gist` appears where `raised_ai` is false, if any field looks like a mention count, or if a source is not a valid https URL.

The public dataset for download is `public/unga81-ai-events-dataset.xlsx`, copied unchanged.

## Commands

```sh
npm ci
npm run validate      # data checks from section 9
npm run build         # validate, build, copy lint, size budgets
npm test              # Playwright with axe, keyboard, URL round trips, no JS, network checks
npx lhci autorun      # Lighthouse CI on the built site
```

Every push to `main` runs the same steps in GitHub Actions and deploys `dist` to GitHub Pages.

## Stack

Astro (static) with one Svelte 5 island for the stage. D3 modules for maths only. SVG marks. Satori and resvg for the Open Graph cards at build time. Fonts are Archivo, Source Serif 4 and Martian Mono from the Fontsource variable packages, subset to Latin and to the axis ranges in use by `scripts/build-fonts.py`, and self hosted. No analytics, cookies or third party requests.
