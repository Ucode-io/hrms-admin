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
- User feedback capture, requested cell-hover quick add: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-5cdb85d4-7a15-4fb5-af42-c33b89f1a315.png`
- Apple source dimensions: 2880 x 1800 px at 2x, normalized to 1440 x 900 CSS px.

## Implementation evidence

- URL: `http://localhost:4173/tasks?view=calendar`
- Capture source: active Chrome local-calendar tab after the quick-add implementation.
- Implementation screenshot: `/tmp/hrms-calendar-hover-qa-2026-09-08.png` (1440 x 778 px viewport capture).
- Chrome viewport: 1440 x 778 CSS px. The 2880 x 1800 source was treated as a 2x reference and compared at its normalized 1440 px CSS width.
- State: light theme, Delever tenant, September 2026 with one visible task, 9 September Month cell hovered.

## Findings

No actionable P0, P1, or P2 mismatch remains in the user-requested areas.

- Fonts and typography: the calendar shell, controls, headers, weekday labels, and time labels use the Apple system font stack with explicit, consistent optical sizes and weights.
- Spacing and layout rhythm: Month now uses a 41 px switcher header, a 58 px title/navigation row, a 40 px weekday row, and six fixed 120 px date rows. Its content uses natural page height instead of squeezing the grid into the remaining viewport; Day and Week retain their viewport-height layout. Calendar mode continues to cancel the application content padding and fill the available content width.
- Colors and visual tokens: the current-day red remains `#ff3b30`; secondary text, separators, surfaces, and task status colors retain appropriate contrast.
- Image quality and asset fidelity: the calendar UI contains no raster artwork requiring recreation. Existing product logo and icon-library assets remain untouched and sharp.
- Copy and content: Russian Day, Week, Month, and Year labels are retained; the List view and its tab were removed as requested.
- Hover affordance: Month, Week, and Day cells expose one 26 x 26 px circular blue quick-add control with a real Lucide Plus icon; it does not displace cell content.

## Focused region comparison

- Month weekday header: all seven labels remain centered; the rendered date cells measure 163.78 x 120 px at the tested viewport.
- Month today indicator: the rendered badge measures exactly 26 x 26 px with a 50% radius.
- Day and Week time axis: labels render at 11 px/11 px, align right with a 10 px gap before the grid, and sit centered on the horizontal slot-line boundary. The axis divider and slot-lane left border are removed.
- Month header/grid boundary: the FullCalendar scroll grid reports a 0 px top border while the lower weekday separator remains visible.
- Month footer: the status-color legend and deadline note are absent, giving the calendar a cleaner Apple-style ending.
- Quick-add focused region: the implementation capture shows the blue control aligned to the top-right of the hovered 9 September cell. Its measured geometry is 26 x 26 px, matching the current-day circle, with `rgb(37, 99, 235)` fill and a white 15 px Plus icon. A separate crop was not needed because the control is clearly readable in the full-view capture.

## Comparison history

1. The initial build inherited a large month-cell height in Day and Week. The rule was scoped to Month; the compact all-day row was verified afterward.
2. The initial Day heading used nominative Russian month text. It was corrected to `7 сентября 2026` and verified in Chrome.
3. The initial Week header was denser than the source. It was simplified to weekday plus date with a circular red current-day state.
4. Follow-up feedback found right-aligned Month weekdays, excess heading-to-grid spacing, an oval current-day badge, a top header line, and hour labels centered inside slots. These were corrected with centered header flex layout, a 72 px heading, fixed 26 x 26 current-day geometry, a zero-width grid top border, and line-aligned slot labels. Post-fix Month, Day, and Week captures were inspected in Chrome.
5. The List tab was removed from the view model, FullCalendar plugin list, and UI. A fresh Chrome load showed only Day, Week, Month, and Year.
6. Follow-up feedback found the time labels visually boxed by an axis divider and the calendar inset by page padding. The divider was removed, labels were aligned to the slot lines, the initial scroll was normalized to show 03:00 like the source, and Calendar mode was expanded edge-to-edge with a `100dvh`-based flex layout. The old fixed Month cell minimum height was also removed so all six calendar weeks fit the available viewport without clipping. Post-fix Day, Week, and Month were captured in Chrome and filled the complete available page area.
7. Follow-up feedback found the Month grid visually undersized after fitting all six weeks into the remaining viewport. Month was changed to natural document height with a 120 px minimum per date cell, while its controls, title row, and weekday header were compacted. The footer status legend was removed. A full-page Chrome capture confirmed six uniform 120 px rows; Day and Week were rechecked at 596 px shell height with no document overflow.
8. The requested hover quick-add control was added as a single positioned interactive element driven by the hovered FullCalendar cell. Month, Week, and Day were exercised independently in Chrome; all three produced a 26 x 26 px blue control for the correct date, and Month click-through opened the task form with 9 September preselected. No P0/P1/P2 visual issue was found in the post-fix comparison.

## Interaction and regression checks

- Day, Week, Month, and Year switching: passed.
- Previous, next, and Today navigation: passed.
- Task event rendering and selection behavior: passed.
- Responsive Year grid and Day inspector behavior: passed.
- Edge-to-edge width and full remaining viewport height in Calendar mode: passed.
- Month natural-height scrolling and 120 px minimum date cells: passed.
- Footer status legend removal: passed.
- Month cell hover and 9 September deadline prefill: passed.
- Week time-slot hover and correct date targeting: passed.
- Day time-slot hover and correct date targeting: passed.
- Fresh Chrome load console errors: none.
- Production build, TypeScript no-emit check, targeted ESLint, and `git diff --check`: passed.

## Follow-up polish

- None required for the requested scope.

final result: passed

---

## Dashed event connectors

- Reference: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-88eaf4a0-a4ba-4676-8e02-9f5d42dc649c.jpg`.
- Added a thin dashed vertical connector from every real Hikvision event tick to its corresponding `Вход` or `Выход` label.
- Connector height follows the collision-avoidance lane, so nearby events remain readable without overlapping.
- Preserved the thick blue first-entry-to-last-exit bar and narrow event ticks.
- Chrome QA on Khasan Sharopov, 15 September 2026 at 1440 × 720: passed. The dense 11:08 / 11:27 / 11:29 labels stay separated and each remains connected to its event tick.

final result: passed

---

## Compact monthly rows and equal-height event markers

- Feedback references: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-b78df9da-8cb4-45d2-a508-84c233024729.png` and `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-7f330f5a-5b2f-4d8c-ac5c-16bf511d6d61.png`.
- Monthly day cards are now compact: arrival and departure icons/times share one row, an unavailable event is represented by a red X without the former visible `Уход не отмечен` copy, and the employee row height is reduced.
- Every populated day includes a restrained progress indicator, `Факт / План 8ч`, and the total worked minutes. Values continue to come from real Hikvision attendance pairs; no time is invented for an incomplete pair.
- Unpaired green entrance markers now use the same 36 px effective height as blue paired-session blocks.
- Chrome QA at 1440 × 720: passed for the full September 2026 overview and Khasan Sharopov's 15 September detail. Layout, labels, progress values, marker heights, and real photo report remained readable with no overlap.

final result: passed

---

## Monthly Hikvision overview follow-up

- Source visual reference: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-1bfdd25e-84e0-4b8d-925b-574ed6a9119e.png`.
- The default `Входы и выходы` overview now requests and renders the complete calendar month instead of a seven-day week.
- The header follows the calendar pattern: month/year label, previous-month action, and next-month action. September renders 30 dated columns; month length is calculated dynamically.
- Day cells use compact calendar-style states: green check for a complete real Hikvision pair, amber clock for an incomplete real record, and a dash for no record. Exact arrival, departure, and duration remain available in the cell's accessible label/tooltip.
- Browser QA: September 2026 rendered all 30 headers from the real monthly attendance query; next-month navigation changed the URL to `2026-10-01` and the label to `Октябрь 2026`; returning restored September.
- Interaction QA: clicking Begzod Norboev's populated 4 September cell opened the same-page detail with `date=2026-09-04` and header `04.09.2026`.
- Empty months continue to show an explicit no-Hikvision-data state; no dummy records are generated.

final result: passed
---

---

# Attendance events overview + real-data detail QA

## Source visual truth

- Weekly employee grid: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-96a390d6-549a-4cab-ac8b-edfb06596878.png`
- Existing attendance shell: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-1ea0ff06-814d-4d72-afb8-97e2302a3439.png`
- Timeline layout reference: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-62eb0e86-c9b3-4488-b252-2ce9d0156586.jpg`

## Implementation evidence

- URL: `http://localhost:4173/time?view=events`
- Browser-rendered overview: `/Users/asadbekbakhodirov/Documents/New project/hrms-admin/attendance-events-simple-overview.png`
- Side-by-side normalized comparison: `/Users/asadbekbakhodirov/Documents/New project/hrms-admin/attendance-events-overview-comparison.jpg`
- Viewport: 1440 x 722 CSS px at device scale factor 1. The 2880 x 1800 source was cropped to its app viewport and downsampled to 1440 x 722 before comparison.
- State: light theme, Delever tenant, week 14–20 September 2026, real Hikvision attendance data.
- Initial state is a weekly employee grid with the same employee / dated daily-event hierarchy as the supplied Timesheet visual.
- Employee rows, arrival times, and departure times come only from real Hikvision-backed `attendance` integration rows. Employees without real events are hidden.
- Clicking a row writes `employee` and the latest active `date` into the same page URL and opens the employee detail.
- Detail uses the selected day's `attendance` rows and raw Hikvision `attendance_records` only; Time Doctor is not queried or rendered.
- Every raw terminal event is placed on the timeline. Hikvision images render only from the real `picture` field; no placeholder or demo image is used.
- When Hikvision returns no records, an explicit empty state is shown.

## Findings

- Fonts and typography: existing HRMS Inter hierarchy is preserved; employee names, dates, event times, and secondary labels remain readable at the tested viewport.
- Spacing and layout rhythm: one page heading and one table surface replace the earlier nested header card and abstract timeline cells. Row rhythm remains aligned with the source grid.
- Colors and tokens: neutral HRMS surfaces are retained; completed pairs use a restrained emerald tint and incomplete pairs use amber. Arrival and departure remain distinguishable by Lucide icons as well as color.
- Image quality and assets: real employee avatars and Hikvision event pictures are retained. No placeholder imagery or generated assets are introduced.
- Copy and content: cells now state arrival, departure, duration, or the exact missing event. The previous abstract weekly-total and line-marker language is removed.
- Focused region comparison: the employee cell and two daily cells were readable in the full-width normalized comparison, so a separate crop was unnecessary.

## Verification

- Targeted ESLint: passed (no errors).
- TypeScript no-emit: passed.
- Production build: passed.
- `git diff --check`: passed.
- Chrome local overview at 1440 x 720: passed with 19 employees from real Hikvision-backed attendance rows for 14–20 September 2026.
- Asadbek Bahodirov click-through: passed. Detail opened 15 September and rendered five real Hikvision terminal events (07:15, 08:07, 08:16, 12:31, 12:38).
- Real event-image rendering: passed. The 12:31 and 12:38 raw records returned and displayed actual `picture` values; events without a picture showed no image placeholder.
- Close timeline labels use two vertical lanes and no longer overlap: passed.
- Back-to-overview, tab state, search field, weekly navigation, and absence of all Time Doctor UI copy: passed.
- Fresh Chrome console after overview → detail → overview: no errors.

## Comparison history

1. P1: the first Hikvision overview reused abstract bars and a weekly total, so arrival versus departure was hard to understand. Replaced with explicit two-line arrival/departure cards and removed the weekly-total column.
2. P2: the first simplification added a second bordered header card, creating unnecessary visual nesting. Removed that surface and kept one plain heading plus one primary table card.
3. P2: incomplete days said only that a full pair was missing. Copy now specifies whether arrival or departure was not recorded.
4. Post-fix side-by-side comparison confirms the source's weekly scan pattern remains, while real Hikvision states are clearer and require no legend decoding.

## Follow-up polish

- None required for the requested simplified overview.

## Timeline thickness follow-up

- Source feedback screenshot: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-d1348350-2540-4ccb-9594-bdc03f3cd926.png`
- Revised browser capture: `/Users/asadbekbakhodirov/Documents/New project/hrms-admin/attendance-events-thick-timeline.png`
- Normalized comparison: `/Users/asadbekbakhodirov/Documents/New project/hrms-admin/attendance-events-thick-timeline-comparison.jpg`
- Both states were normalized to 1440 x 722 CSS px at density 1. The source's app viewport was cropped and downsampled from its 2880 x 1800 browser capture.
- P2 finding: the horizontal timeline track was only 4 px high and visually disappeared behind the event markers. It is now 8 px with the existing neutral slate token; event markers, labels, hour ticks, and card geometry remain aligned.
- Fonts/typography, spacing, colors, real Hikvision image quality, and Russian copy were unchanged by this focused fix.
- Full-view and focused timeline-region comparison: passed. No remaining P0/P1/P2 issue was found.

final result: passed

---

## Session-block timeline and selected-date regression

- Final visual reference: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-028f3b9e-bf3f-4d0f-b953-abc36f33af2d.png`.
- The thin event line was replaced with a high-contrast session block between each real Hikvision entrance and its following exit. Duration is centered inside the block; `Вход · HH:MM` and `Выход · HH:MM` pills remain anchored below it.
- Unpaired terminal events are not fabricated into sessions: they remain narrow entrance/exit markers and retain their real event labels.
- Browser QA on Begzod Norboev, 15 September 2026: passed. The page rendered a real 08:47–11:27 Hikvision pair as a blue `2ч 40м` block, both endpoint pills, and the real event image.
- Selected-date regression QA: passed. Clicking Begzod Norboev's 14 September cell opened `date=2026-09-14`; the detail header rendered `14.09.2026` and showed that day's real 08:17/10:05 terminal records instead of today's records.
- Final production build and `git diff --check`: passed.

final result: passed

---

## Employee-row and dense-event polish

- Feedback references: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-2a7dcb84-6a83-4c97-bd50-ea55e784738c.png` and `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-66d892ed-74b2-45a6-bc78-1478b3d2038e.png`.
- The decorative chevron beside each employee name was removed while preserving row and populated-day click behavior.
- Dense timeline labels now use an uncapped vertical lane sequence. Khasan Sharopov's nearby 11:08, 11:27, and 11:29 events render on three separate rows with no overlap; timeline height expands with the lane count.
- The `Событий` summary metric was replaced by `Опоздание` and `Ранний уход`. Existing attendance delay data is preferred; the existing HRMS 09:00 start rule is the fallback. Early departure is calculated from the real Hikvision checkout against the 18:00 workday end, and remains blank when checkout is missing.
- The event-image section title is now `Фотоотчёт`; all real Hikvision images and event times are preserved.
- Browser QA at 1440 × 722: passed. Khasan Sharopov on 15 September displays `Опоздание 1м`, `Ранний уход 6ч 33м`, separated event labels, and the renamed photo report.

final result: passed

---

## Monthly range with restored detailed cards

- User-selected visual state: the original detailed arrival/departure cards, extended to a full-month range.
- The compact calendar status-only cells were removed. Each populated day again displays real Hikvision arrival, departure, duration, and the exact missing-event message.
- Month query and previous/next month controls remain enabled; September 2026 renders all 30 days horizontally.
- Initial-scroll QA at 1440 × 722: passed. On load, the sticky employee column remains visible and today's `вт, 15 сен` column is centered in the remaining table viewport, with 13–17 September visible around it.
- Real-data and selected-date behavior remain unchanged; empty days are not filled with demo content.

final result: passed

---

## Maximum-density monthly overview

- Feedback reference: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-faf47c46-eb7d-4877-9a89-eaa747353117.png`.
- The standalone `Входы и выходы` heading and Hikvision subtitle were removed from the overview. Month navigation now sits in the same compact, bordered card-header pattern as the existing Calendar view.
- Employee metadata such as `8 дней с отметками` was removed, leaving only avatar and employee name.
- Day-card `Факт / План` copy was removed. The requested compact progress indicator and total worked minutes remain visible beside the real Hikvision arrival/departure values.
- Row padding, avatar size, card radius, card padding, and progress height were reduced without changing click targets or month/today behavior.
- Chrome QA at 1440 × 720: passed. The selected September 2026 overview shows the compact header, seven employee rows above the fold, no visible fact/plan or marked-day copy, and no collisions in populated day cards.

final result: passed

---

## Combined attendance deviation metric

- Feedback reference: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-51cad7ad-d978-4dbd-877e-9d714337c25c.png`.
- `Опоздание` and `Ранний уход` now share one summary card with a subtle internal divider, reducing the detail summary from five cards to four without losing either value.
- Unpaired timeline markers no longer have a white outline or separate shadow; the green marker now uses the same flat, borderless treatment as the blue session block.
- Chrome QA on Aslbek Abduraxmanov, 14 September 2026 at 1440 × 720: passed. Summary alignment, marker visibility, event labels, and the real three-item Hikvision photo report remain intact.

final result: passed

---

## Neutral attendance cells and plan marker

- Feedback references: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-e5a4cc3e-5fd3-48b9-a0cc-efb506de091a.png` and `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-30eba276-3903-4786-ad8f-5820e1617c13.jpg`.
- Day cards now share one neutral white/slate treatment; completed and incomplete days are no longer encoded with green or amber surfaces.
- Arrival and departure retain distinct Lucide icons in the same neutral color. Missing events now combine the corresponding in/out icon with a Lucide ban ring and diagonal stroke, matching the supplied sketch more closely without adding another status color.
- The progress scale now covers 12 hours and includes a black vertical marker at the eight-hour plan position. Real worked time remains visible as the filled segment and formatted duration.
- The progress fill uses emerald green while the card surface, borders, icons, and missing states remain neutral; the black plan marker stays distinct above the fill.
- The former `Посещаемость` tab is now `Список` with a list icon. The Hikvision events tab is now `Посещаемость` with the attendance icon.
- Chrome QA at 1440 × 720: passed. The plan marker, neutral cells, missing-event icon, tab labels, and centered selected date remain clear with real September 2026 data.

final result: passed

---

## Continuous first-entry-to-last-exit timeline

- Feedback reference: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-e6e08812-8b5d-4e3d-9142-ae325adceac9.png`.
- Separate paired-session blocks were replaced by one continuous 36 px blue bar from the day's first real Hikvision entrance to its last real exit, matching the earlier session-block thickness.
- Every real event is marked on that line by a compact vertical tick; entrance and exit ticks retain their green/blue event semantics and their timestamp labels below the track.
- A day without a valid first-entry/last-exit span does not receive a fabricated line; its real event ticks remain visible.
- Chrome QA on Aslbek Abduraxmanov, 14 September 2026 at 1440 × 720: passed. The line spans 09:20–18:53, the intermediate 17:31 entrance is visible as a small tick, and all three labels remain non-overlapping.
- Dense-event regression QA on Nurmuhammad Mahmudov passed: 07:26, 08:02, and 08:18 labels use separate lanes while their vertical event ticks remain narrow over the thick bar.

final result: passed

---

## Last-action span and integrated endpoints

- The continuous timeline now runs from the first real Hikvision entrance to the chronologically last real action of the day, regardless of whether that action is an entrance or an exit.
- Timeline events are sorted by their parsed clock value before the span and label lanes are calculated.
- The first and last event ticks are inset into the blue bar endpoints so they no longer protrude through the rounded corners.
- Chrome QA on Khasan Sharopov, 15 September 2026 at 1440 × 720: passed. The bar now ends at the final 11:29 entrance rather than the earlier 11:27 exit, and both endpoints remain cleanly contained.

final result: passed

---

## Seamless timeline endpoint caps

- Feedback reference: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-743436ab-637a-4e99-aad8-9e0062b30b7e.png`.
- The first and last action ticks are now rendered inside the blue attendance bar's clipped rounded container instead of as separate rounded siblings.
- This produces continuous caps at both ends with no doubled radius, protruding edge, or visible gap between the event color and blue.
- Chrome QA on Khasan Sharopov, 15 September 2026 at 1440 × 720: passed. The 09:01 starting entry and final 11:29 entry both merge cleanly into the bar's rounded endpoints.

final result: passed
