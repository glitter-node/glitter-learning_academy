# Upstream proposal: preserve and resolve template layout overrides

## Summary

Gnuboard7 compiles a valid template `<override>` document with `layout_name`, `version`, and `version_constraint`, but `TemplateManager::registerLayoutOverrides()` removes the identity and compatibility fields before persisting `template_layouts.content`. The installed document is therefore neither a valid layout nor a valid override. A later active-module layout sync can also replace that template-owned row with the module-owned layout because the generic synchronizer looks up by `(template_id, name)` even though the database uniqueness contract includes `source_type`.

This is a core contract defect. It cannot be repaired safely from a template bundle without patching core services or directly rewriting database rows, both of which are intentionally out of scope.

## Reproduction

Environment observed on 2026-10-27:

- Gnuboard7 checkout requiring `g7_version >=7.1.1`
- `glitter-learning` 1.0.0 active
- `glitter-learning_academy` 1.0.0 installed but inactive
- override source: `templates/_bundled/glitter-learning_academy/layouts/overrides/glitter-learning/course_list.g7.html`

The source uses the supported grammar:

```html
<override name="glitter-learning.course_list" version="1.0.0" version-constraint="^1.0">
  ...
</override>
```

Source-only validation:

```bash
/usr/local/bin/php83 artisan layout:decompile \
  templates/_bundled/glitter-learning_academy/layouts/overrides/glitter-learning/course_list.g7.html
```

Installed-row audit:

```bash
/usr/local/bin/php83 artisan layout:check-installed \
  --template=glitter-learning_academy --json
```

Observed installed errors for `course_list`, `course_detail`, `lesson`, and `my_learning`:

```text
필수 필드 'layout_name' 값이 누락되었습니다. [layout_structure_invalid]
```

The current installed rows predate the corrected fully qualified names and are named `course_list`, `course_detail`, `lesson`, and `my_learning`. Updating the bundle source alone cannot repair those database rows in this task.

## Expected behavior

1. The template installer persists a recognizable override document, including its target name and module-version constraint.
2. A compatible template override wins over the module layout with the same public layout name.
3. An incompatible override falls back to the module layout.
4. Module synchronization supplies or preserves the target module layout's base-layout inheritance without replacing the template override.
5. Runtime resolution uses the stored override and its inherited template base.
6. `layout:check-installed` round-trips the installed row successfully.

## Actual data flow and first contract break

### 1. Source to compiled document: correct

`app/Support/LayoutMarkup/DocumentCompiler.php::compileOverride()` (currently around lines 1214-1241) maps:

- `name` to `layout_name`
- `version` to `version`
- `version-constraint` to `version_constraint`
- child `slot`, `meta`, and `data-source` elements to their document sections

The Academy sources use the module-prefixed target names that `ModuleManager` registers, for example `glitter-learning.course_list`.

### 2. Compiled document to install content: broken

`app/Extension/TemplateManager.php::registerLayoutOverrides()` calls `extractLayoutContent()` around lines 1983-1986. `extractLayoutContent()` around lines 2167-2187 retains only:

- `slots`
- `meta`
- `data_sources`
- `version`

It drops `layout_name` and `version_constraint`. This is the first loss of required information.

The method also passes `extends => $layoutData['extends'] ?? null` to `LayoutRowSynchronizer`. The official `<override>` grammar rejects an `extends` root attribute, so this value is necessarily null for a conforming override.

### 3. Database row: internally inconsistent

The row name contains the target identity, while the content no longer identifies itself as an override. The `extends` model column is null. The original-content snapshot is truncated by the same extractor, so the missing metadata cannot be recovered from `original_content` either.

### 4. Installed audit: valid failure, not only a false positive

`app/Console/Commands/Layout/LayoutCheckInstalledCommand.php::checkLayouts()` passes only row content to `checkRow()`. `LayoutMarkupDecompiler::document()` recognizes an override only when `version_constraint` exists. With that field missing, it emits a `<layout>` without `name`; recompilation then correctly reports the missing `layout_name`.

The audit could reconstruct identity from DB columns, but doing only that would hide the runtime defects below. Classification **F (checker false positive)** is therefore rejected as the sole cause.

### 5. Compatibility resolution: broken open

`app/Services/LayoutResolverService.php::checkOverrideVersionCompatibility()` reads `version_constraint` only from `content`. Since installation removed it, every stored override is treated as unconstrained and compatible. The documented incompatible-version fallback cannot operate.

### 6. Inheritance at runtime: broken

`app/Services/LayoutService.php::loadAndMergeLayoutInternal()` reads `extends` only from decoded content. It does not fall back to `TemplateLayout::$extends`. Even if the installer populated the DB column, runtime inheritance would still not occur.

The override grammar contains no `extends`, so a valid override needs the target module layout's base-layout relationship to be carried separately and consumed here. Without `_user_base`, the Academy shell, authentication state, navigation, footer, toast host, theme and locale controls are not composed.

### 7. Activation/module synchronization: overwrite risk confirmed

`TemplateManager::activateTemplate()` refreshes template layouts first (around lines 824-831), then calls `ModuleManager::registerLayoutsForAllActiveModules()` (around lines 833-841).

`ModuleManager::registerLayoutToTemplate()` submits the module layout using the same fully qualified name. `LayoutRowSynchronizer::syncLayout()` looks up by template ID and name only. The schema already permits one row per `(template_id, name, source_type)` (`uk_template_layout_source`), but the synchronizer does not use that discriminator. When the first match is the template row and it is not operator-modified, the branch around lines 108-111 calls `overwriteLayout()`, replacing `source_type`, `source_identifier`, content, and original metadata with the module values. The override then ceases to be a template override at all.

## Cause classification

| Class | Result | Evidence |
| --- | --- | --- |
| A. Academy source syntax | Not the remaining cause | Current sources compile with supported `<override>` attributes and fully qualified target names. |
| B. Installer metadata loss | Confirmed | `extractLayoutContent()` drops `layout_name` and `version_constraint`. |
| C. DB/runtime contract mismatch | Confirmed | `extends` is modeled as a column but `LayoutService` reads only content; compatibility reads only stripped content. |
| D. Module layout composition missing | Confirmed for base inheritance | The override cannot declare `extends`, and the target module's base inheritance is not supplied or consumed. Slot content appears intended as a replacement, so wholesale slot merging is not proposed. |
| E. Module sync priority error | Confirmed | Module sync can overwrite the template-owned row after template refresh. |
| F. Installed checker false positive | Secondary only | It exposes a genuinely malformed stored document; reconstructing fields only in the checker would not fix runtime behavior. |

## Minimal upstream change

The smallest change that follows the existing multi-source schema and the documented replacement-style override grammar has three coordinated parts.

### 1. Preserve the override envelope in stored content

Change the override extractor (or introduce a dedicated `extractOverrideLayoutContent`) so stored `content` and `original_content` include:

```php
foreach (['layout_name', 'version', 'version_constraint', 'slots', 'meta', 'data_sources'] as $key) {
    if (array_key_exists($key, $layoutData)) {
        $content[$key] = $layoutData[$key];
    }
}
```

Using `array_key_exists()` avoids silently dropping explicit nulls if the schema later permits them. Do not fabricate metadata in `layout:check-installed`; persist the compiler output at the source boundary.

### 2. Synchronize rows by the schema's source identity

Add a repository lookup that includes `source_type`, and use it for both the existing-row lookup and the `updateOrCreate` match in `LayoutRowSynchronizer::syncLayout()`:

```php
$row = $this->layouts->findWithTrashedByNameAndSource(
    (int) $identity['template_id'],
    $identity['name'],
    $identity['source_type'],
);

$match = [
    'template_id' => (int) $identity['template_id'],
    'name' => $identity['name'],
    'source_type' => $identity['source_type'],
];
```

This lets the module row and template override row coexist exactly as `LayoutRepository::findTemplateOverride()` and `findModuleLayout()` already expect. `source_identifier` should remain an updated value rather than part of the unique key because the schema's canonical uniqueness is source type, not owner identifier.

### 3. Derive override inheritance from the coexisting module row

When the resolved row is a template override and neither its content nor `extends` column supplies a parent, load the coexisting module row with the same public layout name and use that row's `extends` value (content first, modeled column second). Then feed the derived value into the existing inheritance path:

```php
$parent = $layoutData['extends'] ?? $layout->extends;

if (! $parent && $layout->source_type === LayoutSourceType::Template) {
    $moduleBase = $this->layoutRepository->findModuleLayout($templateId, $layoutName);
    $moduleData = $moduleBase
        ? LayoutEmptyObjects::decode($moduleBase->getAttributes()['content'] ?? null, $moduleBase->content ?? [])
        : [];
    $parent = $moduleData['extends'] ?? $moduleBase?->extends;
}

if (is_string($parent) && $parent !== '') {
    $layoutData['extends'] = $parent;
}
```

The final code should identify an override with the same enum-safe helper used by the repository/model rather than comparing an enum to a string. It should also assert that the fully qualified layout prefix matches the module row owner. The existing inheritance path can then merge `_user_base` without inventing an unsupported source attribute.

## Why no core patch file is included

A patch is intentionally not supplied because the owner-match check needs a maintainer decision about the canonical target-module identity source. The override row's `source_identifier` is the template, while the target module is encoded in the fully qualified layout name and override directory. Guessing that policy in an apply-ready patch would weaken collision safety. The three exact change sites and required invariant are documented above without presenting an unsafe patch as final.

## Before/after flow

### Before

```text
<override name + constraint>
  -> compiler keeps metadata
  -> installer strips name + constraint, extends=null
  -> audit sees anonymous normal layout and fails
  -> compatibility defaults to compatible
  -> module sync may replace template row
  -> runtime cannot inherit _user_base
```

### After

```text
<override name + constraint>
  -> compiler keeps metadata
  -> installer persists override envelope
  -> module sync creates/updates a distinct module row
  -> resolver enforces module-version constraint
  -> runtime reads extends column fallback and composes _user_base
  -> audit round-trips the stored override
```

## Compatibility and fallback

- Compatible overrides remain selected by `LayoutResolverService`.
- Incompatible overrides fall back to the distinct module row through the existing `LayoutResolverService` path.
- The database already supports both rows because `uk_template_layout_source` includes `source_type`; the synchronizer and its repository lookup must honor that key.
- A missing module row must remain a hard missing-layout condition rather than silently accepting an incompatible override.

Production activation remains blocked until coexistence, compatibility fallback, and base inheritance all pass installed-layout and runtime verification.

## Impact on existing templates and modules

- Ordinary template layouts are unchanged because the extractor is used only for overrides.
- Module layouts without a template collision follow the existing synchronizer path; collided names create/update their module-source row instead of mutating the template-source row.
- Template overrides retain source ownership instead of being silently converted to module rows.
- Existing malformed rows require an official template update/refresh after the core fix; source changes alone do not rewrite them.
- Existing operator-modified rows must retain current keep/merge protection. The new collision branch must not overwrite operator content.

## Regression risks

1. A name collision unrelated to an intentional override could be composed incorrectly unless target-module ownership is checked.
2. Treating every override as inheriting the module layout's `extends` may be wrong for a future standalone override grammar; explicit schema semantics should be documented.
3. Incompatible override fallback cannot be claimed until a distinct module base remains resolvable.
4. Three-way merge hashes change when envelope metadata begins to be stored; upgrade logic should treat the corrected compiled source as the new file base, not as an operator edit.
5. Cache keys for resolver and merged layouts must be invalidated after row ownership or `extends` changes.

## Required verification after an upstream fix

1. Compile/decompile all four Academy override sources and confirm exact round trips.
2. Install the template into a disposable non-production fixture in upstream CI.
3. Assert stored content contains `layout_name` and `version_constraint` and the row remains template-owned after module sync.
4. Assert stored/inherited `extends` resolves `_user_base` in the rendered layout.
5. Assert `layout:check-installed --template=glitter-learning_academy` reports all four rows as `ok`.
6. Test module versions inside and outside `^1.0`; the latter must render the module default layout.
7. Re-run module update and template update in both orders; the override must remain authoritative when compatible.
8. Cover operator-modified override content under keep and overwrite lifecycle modes.

## Can the template solve this alone?

No. Adding dummy keys would only make the checker quieter, not establish inheritance, version fallback, or synchronization priority. Direct DB edits, service replacement, monkey patches, and duplicated module layouts would bypass the official lifecycle and are not acceptable fixes.
