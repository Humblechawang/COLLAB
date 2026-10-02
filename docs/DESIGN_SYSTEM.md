# Design System

## Product tone

Collab is a social workspace for teams: lively, welcoming, collaborative, and easy to scan. The same visual palette is used across marketing, sign-in, sign-up, and the dashboard. Layout density can change by task, but the product should not feel like a separate luxury brand or storefront.

## Color and typography

- Page background: fresh pale mint `#f7faf8`.
- Section surface: soft green `#eaf2ed`.
- Main text: deep green-charcoal `#1e332d`.
- Primary action/accent: community teal `#328270` with darker hover `#286b5d`.
- Semantic colors remain paired with labels: green for success, amber for pending, rose for alerts, and purple for research.
- Headings and controls use Plus Jakarta Sans with the existing system fallbacks.
- Keep display text bold and friendly, with readable body sizes and no display-serif luxury treatment.

## Layout and components

- Brand: a standalone C-shaped mark visually completes the lowercase “ollab” wordmark; use the same lockup in the header, footer, and workspace.
- Header: larger logo and wordmark on the left; navigation and actions aligned right.
- Cards use moderate corner radii, clear hierarchy, and restrained shadows.
- Public pages retain broad photos, the framed portfolio preview, numbered story/photo interaction, and scroll reveals.
- The Posts timeline scrolls vertically. Home update cards and attached post photos use horizontally swipeable snap rails.
- Dashboard posts and deliverables remain feed-like, with member identity and text-first Like/Comments actions.
- Mobile layouts stack content, keep the logo left/menu right, and avoid horizontal overflow.

## Motion and interaction

- Scroll-triggered reveals support public page pacing.
- Section headings receive a brief text shimmer and the portfolio frame photo enters when scrolled into view.
- Photo selection updates image, alt text, caption, copy, and active state together with a fade/scale transition.
- Native buttons expose selected state with `aria-pressed` where applicable.
- Preserve the audience selector, showcase tabs, sticky chapter transitions, and FAQ accordion.
- Honor `prefers-reduced-motion`; motion is supplementary, never required to understand state.

## Accessibility and trust

- Keep visible focus styles and sufficient contrast.
- Use clear text labels instead of emoji-only controls.
- Pair status color with readable state text.
- Demo access is local-preview-only and uses sample, in-memory data that resets on refresh.
- Backend/database authorization remains authoritative for membership and public/private data; visual settings do not enforce access control.
