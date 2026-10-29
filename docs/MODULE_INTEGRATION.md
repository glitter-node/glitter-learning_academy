# Module integration contract

Glitter Learning Academy 1.0.0 owns presentation routes only. Data access and authorization remain in the three required modules.

## Dependency ownership

| Owner | Dependency | Constraint | Observed compatible version | Reason |
| --- | --- | --- | --- | --- |
| Academy template | `glitter-learning` | `^1.0` | 1.0.0 | Course, enrollment, progress, completion APIs and layouts |
| Academy template | `sirsoft-board` | `^1.2` | 1.2.1 | Public board directory, recent posts, post list/search/detail |
| Academy template | `sirsoft-page` | `^1.2` | 1.2.1 | Published page detail |

The Glitter Learning module has no source reference to either Sirsoft module and retains empty module/plugin dependencies. The two Sirsoft modules also declare no module dependencies, so this graph has no cycle.

## Board contract

All calls use the module's public API under `/api/modules/sirsoft-board` and optional Sanctum authentication. The permission middleware remains authoritative; the template does not reproduce permission rules.

| Academy use | Method and endpoint | Response fields consumed |
| --- | --- | --- |
| Home recent posts | `GET /boards/posts/recent?limit=5` | `id`, `board_slug`, `board_name`, `title`, `author_name`, `created_at` |
| Board directory | `GET /boards?limit=3` | `id`, `name`, `slug`, `description`, `posts_count` |
| Post list/search | `GET /boards/{slug}/posts` | `data[]`, `pagination`, `board`, `abilities.can_write` |
| Post detail | `GET /boards/{slug}/posts/{id}` | title/content/content_mode/author/date/count fields after server-side access filtering |

Academy presentation routes are `/boards`, `/board/:slug`, and `/board/:slug/:id`. They are required because `sirsoft-board` exposes user APIs but does not ship user-template layouts or routes. Search sends the documented `search` value with `search_field=title_content`; pagination uses the response's `current_page` and `has_more_pages` fields.

The API can report guest or member write ability through `abilities.can_write`, which the list screen displays. Academy 1.0.0 deliberately does not implement post authoring: a correct form must cover the module's form metadata, guest identity/password flow, secret/notice policy, attachments, replies, editor mode, validation and mutation feedback. Reusing private `sirsoft-comm` components would violate template independence.

## Page contract

Published page detail uses `GET /api/modules/sirsoft-page/pages/{slug}` with optional Sanctum authentication and is presented at `/page/:slug`. The template consumes localized `title`, `content`, `content_mode`, `published_at`, `seo_meta`, preview state, and public attachment URLs.

The module exposes no public page-list endpoint. Academy therefore cannot discover an About or Guide page and does not invent `academy-about`, `guide`, or another slug. Operators must create/publish the desired pages and use a future supported navigation/configuration surface to add their direct `/page/{slug}` links.

## Failure isolation

Home course and community data sources are independent. The board request has a local failure state and fallback array, so a board API failure does not suppress the course section. Directory, post-list, post-detail and page-detail layouts each provide loading, empty/unavailable and back-navigation states.

HTML returned by the official board/page APIs is rendered through the Academy `HtmlContent` component. It applies a client-side deny list for executable/embedded/form content, event and style attributes, unsafe URL protocols, and adds `noopener noreferrer` to external new-window links. Server-side module filtering and permission checks remain the primary security boundary.

## Not implemented or assumed

- No board, post, or page is created by the template.
- No notice/community slug is assumed.
- No public page list is synthesized from an admin API.
- No controller, model, repository or service class from either module is called directly.
- No admin CRUD is duplicated.
- No database schema or record is owned or modified by the template.
