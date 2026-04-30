# Craft-Style Sidebar Spec

## Summary

Redesign the sidebar to feel closer to Craft's document tree: tighter spacing, subtler visual hierarchy, breathing room around section labels, and a more document-centric look than a generic file explorer.

This is a follow-up to the already-shipped workspace visual redesign, scoped specifically to the sidebar tree presentation.

## Goals

- Reduce visual noise: thinner row dividers, gentler indentation, lighter folder iconography.
- Improve typographic hierarchy: titles read first, paths and metadata recede.
- Add subtle section grouping (pinned, recent, all docs) without making the tree feel like a layered widget.
- Keep the tree functional, fast, and accessible.

## Non-Goals

- A graph view, tag panel, or backlinks pane (other specs cover those).
- A second navigation surface alongside the tree.
- Theming primitives (covered by the body theming spec).

## UX Decisions

### Layout

- Reduce row height slightly.
- Remove explicit row dividers; rely on spacing.
- Folder caret should be lighter weight; consider a chevron hover affordance only.
- Indentation guides should be very subtle (1px, low-contrast), only visible on hover or when a parent is selected.

### Typography

- Document title in primary text color, slightly larger.
- File extension hidden by default (showable on hover or via setting).
- Active row uses a tinted background, not a strong accent bar.

### Section grouping

- Top section: `Pinned` (only shown when there are pins).
- Middle section: workspace tree.
- Optional bottom section: `Recent` (only shown when meaningful).

Each section uses a small uppercase label with generous top padding.

## Implementation Notes

- Most changes are CSS / structural; the underlying tree data model can stay the same.
- Pull color and spacing values into design tokens so the redesign stays consistent with the rest of the workspace redesign.
- Coordinate with `hide-sidebar-handle-spec.md` so the boundary treatment is consistent.

## Files Expected To Change

- `apps/desktop/src/components/sidebar/`
- design token stylesheet
- minimal store changes only if section grouping requires new selectors

## Acceptance Criteria

- The sidebar visually resembles the reference screenshot's level of restraint.
- Hierarchy is communicated by spacing and weight rather than borders.
- Existing tree interactions (click, expand, context menu, multi-select) keep working unchanged.
