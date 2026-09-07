# Calendar visual QA

## Reference set

- Month: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-c27f2769-760a-4974-8e1e-a00bd3295618.png`
- Day: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-73e739ac-f2e2-465b-9c0d-0b489cc41439.png`
- Week: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-2f3e286f-0eac-447e-830a-2b777e59b17a.png`
- Year: `/var/folders/bh/sn339sh911d44c5l91srlzrr0000gn/T/codex-clipboard-4496de40-7755-4da2-820d-19e39e611989.png`
- Reference dimensions: 2880 x 1800 px for each screenshot.

## Implementation capture

- URL: `http://localhost:4173/tasks?view=calendar`
- Capture source: active Codex in-app browser, tab 1. The browser API did not expose a filesystem path for the capture.
- Viewport: 812 x 758 CSS px at device-pixel ratio 2 (1624 x 1516 device px).
- State: light theme, Vegapharm tenant, current September 2026 task data.

## Comparison

The full calendar view and focused header, date-grid, time-grid, task-event, and responsive year-grid regions were compared against the Apple Calendar references.

- The two-level toolbar, centered segmented view switcher, large period title, Today control, and previous/next controls follow the reference hierarchy.
- Month view uses the same open grid rhythm, muted out-of-month dates, and circular current-day treatment while preserving HRMS task cards and status colors.
- Day and Week views use compact all-day rows followed by hourly time grids. The Week header uses compact weekday/date labels and a red current-day circle.
- Year view presents all 12 months as lightweight mini calendars and adapts from four columns down to one column.
- HRMS-specific differences are intentional: Russian labels, Monday-first weeks, application sidebar/header, task status legend, task modal behavior, and the retained List view.

## Iterations completed

1. Scoped the legacy month-cell minimum height so it no longer expanded the Day and Week all-day rows.
2. Corrected the Russian day heading from nominative month text to `7 сентября 2026`.
3. Simplified Week headers to Apple-style weekday plus date and added the red current-day indicator.

## Interaction and regression checks

- Day, Week, Month, Year, and List switches: passed.
- Previous and next month navigation: passed.
- Task event rendering, status colors, avatar, overdue state, and task-opening behavior: passed.
- Responsive Year grid and compact Day layout at the tested viewport: passed.
- Production build: passed.
- Targeted ESLint for `CalendarView.tsx`: passed.
- Browser console errors: none.

## Final result

passed
