# UI/UX Audit

## Product context

Collab is a static single-page frontend for a social team platform. The reference site informed the image-led pacing, numbered content selection, and scroll transitions; Collab keeps its own more social, energetic mint/teal palette and sans-serif typography across all routes.

The redesign borrows interaction patterns, not the reference's identity, copy, or photography. Collab retains its builder-team content and existing product controls.

## Existing strengths

- The landing page explains the team-portfolio proposition and includes real product content.
- The audience selector and showcase tabs already give visitors direct control over what they see.
- The dashboard separates Home, Posts, Work, Team, and Settings.
- Admin privacy controls expose a core product rule: public portfolio content must remain distinct from private team work.
- The sign-in and sign-up flows are familiar and remain separate from the marketing theme.

## Previous experience issues

- The blue product-window/globe combination felt like a different visual genre from the reference's calm, photo-led editorial layout.
- Strong rounded surfaces and gradient text competed with the reference's restrained type and image composition.
- The large amount of movement did not consistently follow the user's scroll or selected content.
- The marketing page had no focused image/story interaction that connected the photo to the selected message.

## Current implementation

- All routes share a mint/teal palette and Plus Jakarta Sans typography; auth and dashboard remain task-focused while visually consistent.
- The enlarged logo and wordmark sit on the left, with desktop navigation and actions aligned right.
- The hero keeps Collab's product-window preview, reframed as a quiet portfolio presentation rather than a browser chrome mockup.
- The former decorative globe is removed from the homepage.
- Emoji have been removed from frontend labels and replaced with text or CSS marks.
- Local sample demo is accessible on localhost, private LAN, and direct `file:` previews; its in-memory edits reset on refresh.
- A numbered, four-part story selector updates its image, text, and caption in place with a crossfade/zoom transition.
- Major homepage sections reveal on scroll; the public theme is scoped away from auth and dashboard routes.
- Existing audience selection, showcase tabs, sticky chapter interaction, and FAQ controls remain available.

## Functional areas to preserve

### Authentication
Keep Supabase sign-in/sign-up, session restoration, and local-only demo gating unchanged.

### Workspace
Keep Posts, Work, Team, and Settings route/state behavior unchanged. Visibility settings and admin/member permissions are product requirements, not styling details.

### Public/private boundaries
Never infer access from presentation. The existing backend and database rules remain the authority for private posts, work, and team membership.

## Accessibility and responsive checks

- The new selector is keyboard-operable native buttons and exposes its selected state with `aria-pressed`.
- Image alt text, captions, and the selected copy change together.
- Public scroll and image motion honor the existing reduced-motion stylesheet.
- The hero and photo panel have explicit tablet/mobile dimensions and stack into one column at narrow widths.
- Browser verification is still needed for focus order, loaded remote fonts/images, and real device viewport behavior.

## Remaining UX opportunities

- Add persistent public/private status in the workspace shell without implying that frontend state enforces authorization.
- Add explicit confirmation for consequential visibility and delete actions.
- Validate all marketing claims against live product capabilities before public launch.
