# Glitter Learning Academy

Current release: 1.0.1. The integrated search layout preserves the query and selected type while using the Search Hub response page metadata for previous/next navigation. Empty results and transport/provider failures are presented as separate states.

The Academy owns its presentation routes for `/learning`, course detail, lesson study, and the learner dashboard. These are ordinary template layouts extending `_user_base`; they are not module layout overrides. All learning data and mutations continue to use the public `glitter-learning` API.

Glitter Learning Academy is a Gnuboard7 user template for `glitter-learning`, `sirsoft-board`, `sirsoft-page`, and `glitter-search_hub`. It provides a responsive academy home, course discovery, lesson learning, dashboards, completion history, public community browsing, published information pages, authentication entry points, profile, search, and error states while leaving domain data and business rules in the owning module APIs.

## Requirements

- Gnuboard7 7.1.1 or later
- Supported UI locales: Korean (`ko`) and English (`en`). Other system locales are not exposed by this template; a saved unsupported locale falls back to Korean.
- Active `glitter-learning` module compatible with `^1.0`
- Active `sirsoft-board` module compatible with `^1.2`
- Active `sirsoft-page` module compatible with `^1.2`
- Active `glitter-search_hub` module compatible with `^0.1.3`
- Active official `sirsoft-ckeditor5` plugin compatible with `>=1.1.1`
- PHP 8.2 or later

The `sirsoft-ckeditor5` plugin must be installed and active before this
template is activated or updated. It supplies the official `html_editor`
extension used by the Academy's HTML course editor; the template does not
bundle or implement CKEditor itself. Missing or incompatible dependencies are
handled by Gnuboard7's official template lifecycle checks.

Glitter Search Hub is required for the Academy's integrated search provider registry and its Courses/Lessons provider integration. The Search Hub must be active for the Academy search experience to discover and query learning providers alongside Board and Page content.

## Build and lifecycle

Use the official Gnuboard7 `template:build`, `template:install` or `template:update`, and `template:activate` commands. Do not edit the installed template directory or generated assets directly.

## Data ownership

The template does not own course, enrollment, progress, or completion tables. Every learning workflow calls the public Glitter Learning API. Course images, instructor profiles, difficulty, and estimated duration are intentionally not synthesized because the module API does not provide them.

Community screens call only the public `sirsoft-board` APIs. Version 1.0 provides the board directory, public post lists, search, post details, recent posts on the Academy home, and a visible read/write permission state. Post authoring is not duplicated in this template; it requires a separately reviewed user-authoring layout that follows the board module's complete form, guest-password, attachment, and validation contracts.

Published information pages are rendered from `/api/modules/sirsoft-page/pages/{slug}` at `/page/{slug}`. The page module does not expose a public page-list API, so the template does not guess or hardcode Academy About or Guide slugs. Administrators must create and publish those pages and add links through a supported navigation/configuration surface before such links can appear.

## Layout integration

Academy deliberately uses ordinary template-owned `learning/*` layouts. Template routes are merged before active-module routes and the client router selects the first matching route, so Academy can preserve the public `/learning` URLs without relying on module layout overrides. The historical override defect remains documented in `docs/UPSTREAM_LAYOUT_OVERRIDE_FIX.md` for upstream maintainers, but Academy no longer depends on that code path.

## License

MIT © Glitter.kr
