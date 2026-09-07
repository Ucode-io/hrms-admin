# Calendar visual QA

## Source visual truth

- Apple Month: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-c27f2769-760a-4974-8e1e-a00bd3295618.png`
- Apple Day: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-73e739ac-f2e2-465b-9c0d-0b489cc41439.png`
- Apple Week: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-2f3e286f-0eac-447e-830a-2b777e59b17a.png`
- Apple Year: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-4496de40-7755-4da2-820d-19e39e611989.png`
- User feedback capture, Month: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-4d0c3d52-69ad-4081-8558-51951b47167d.png`
- User feedback capture, Apple Day: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-123e21e2-3e7d-4574-9a80-e33ee39d9e11.png`
- User feedback capture, implementation Day: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-cc8aa5c1-0b9b-4102-ad83-d659fddd2be8.png`
- User feedback capture, non-full Day: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-2dc80f36-b3f2-4035-a5d4-146867b78485.png`
- User feedback capture, Apple time axis: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-47939225-bf50-4084-841f-f8bfd89d0a16.png`
- User feedback capture, undersized Month cells: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-906d86ac-4050-4869-94e4-80ad27dadb72.png`
- Apple source dimensions: 2880 x 1800 px at 2x, normalized to 1440 x 900 CSS px.

## Implementation evidence

- URL: `http://localhost:4173/tasks?view=calendar`
- Capture source: active Chrome local-calendar tab and a full-page Chrome capture after the Month sizing fix.
- Implementation screenshot: `/tmp/hrms-calendar-month-qa-2026-09-07.png` (1440 x 992 px full-page capture).
- Chrome viewport: 1440 x 722 CSS px, device-pixel ratio 2. Browser output was visually normalized to the CSS viewport for comparison.
- State: light theme, Delever tenant, September 2026 with one visible task.

## Findings

No actionable P0, P1, or P2 mismatch remains in the user-requested areas.

- Fonts and typography: the calendar shell, controls, headers, weekday labels, and time labels use the Apple system font stack with explicit, consistent optical sizes and weights.
- Spacing and layout rhythm: Month now uses a 41 px switcher header, a 58 px title/navigation row, a 40 px weekday row, and six fixed 120 px date rows. Its content uses natural page height instead of squeezing the grid into the remaining viewport; Day and Week retain their viewport-height layout. Calendar mode continues to cancel the application content padding and fill the available content width.
- Colors and visual tokens: the current-day red remains `#ff3b30`; secondary text, separators, surfaces, and task status colors retain appropriate contrast.
- Image quality and asset fidelity: the calendar UI contains no raster artwork requiring recreation. Existing product logo and icon-library assets remain untouched and sharp.
- Copy and content: Russian Day, Week, Month, and Year labels are retained; the List view and its tab were removed as requested.

## Focused region comparison

- Month weekday header: all seven labels remain centered; the rendered date cells measure 163.78 x 120 px at the tested viewport.
- Month today indicator: the rendered badge measures exactly 26 x 26 px with a 50% radius.
- Day and Week time axis: labels render at 11 px/11 px, align right with a 10 px gap before the grid, and sit centered on the horizontal slot-line boundary. The axis divider and slot-lane left border are removed.
- Month header/grid boundary: the FullCalendar scroll grid reports a 0 px top border while the lower weekday separator remains visible.
- Month footer: the status-color legend and deadline note are absent, giving the calendar a cleaner Apple-style ending.

## Comparison history

1. The initial build inherited a large month-cell height in Day and Week. The rule was scoped to Month; the compact all-day row was verified afterward.
2. The initial Day heading used nominative Russian month text. It was corrected to `7 сентября 2026` and verified in Chrome.
3. The initial Week header was denser than the source. It was simplified to weekday plus date with a circular red current-day state.
4. Follow-up feedback found right-aligned Month weekdays, excess heading-to-grid spacing, an oval current-day badge, a top header line, and hour labels centered inside slots. These were corrected with centered header flex layout, a 72 px heading, fixed 26 x 26 current-day geometry, a zero-width grid top border, and line-aligned slot labels. Post-fix Month, Day, and Week captures were inspected in Chrome.
5. The List tab was removed from the view model, FullCalendar plugin list, and UI. A fresh Chrome load showed only Day, Week, Month, and Year.
6. Follow-up feedback found the time labels visually boxed by an axis divider and the calendar inset by page padding. The divider was removed, labels were aligned to the slot lines, the initial scroll was normalized to show 03:00 like the source, and Calendar mode was expanded edge-to-edge with a `100dvh`-based flex layout. The old fixed Month cell minimum height was also removed so all six calendar weeks fit the available viewport without clipping. Post-fix Day, Week, and Month were captured in Chrome and filled the complete available page area.
7. Follow-up feedback found the Month grid visually undersized after fitting all six weeks into the remaining viewport. Month was changed to natural document height with a 120 px minimum per date cell, while its controls, title row, and weekday header were compacted. The footer status legend was removed. A full-page Chrome capture confirmed six uniform 120 px rows; Day and Week were rechecked at 596 px shell height with no document overflow.

## Interaction and regression checks

- Day, Week, Month, and Year switching: passed.
- Previous, next, and Today navigation: passed.
- Task event rendering and selection behavior: passed.
- Responsive Year grid and Day inspector behavior: passed.
- Edge-to-edge width and full remaining viewport height in Calendar mode: passed.
- Month natural-height scrolling and 120 px minimum date cells: passed.
- Footer status legend removal: passed.
- Fresh Chrome load console errors: none.
- Production build and targeted ESLint: passed.

## Follow-up polish

- None required for the requested scope.

final result: passed
