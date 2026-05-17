# @bc/file-list

The panel's file list, factored out of `@bc/ui-rn` so view modes can be added without touching the panel chrome. View modes are the polymorphism axis: Brief (name + ext), Full (+ size, date, attr), and later Comments, Thumbnail, Tree, Custom columns. Plugins can register additional views via the registry.

**Exports**
- `Row` (`ParentRow | EntryRow`), `SortSpec`, `SortKey` — list data model. `..` is a synthetic `ParentRow` always first.
- `FileListView`, `FileListViewProps` — the contract each view implements.
- `briefView`, `fullView` — built-in views matching TC's Brief and Full modes.
- `FileList` — thin shell that renders the active view.
- `FileListViewRegistry`, `createDefaultRegistry()` — id→view map.
- `ColumnHeader`, `ColumnDef` — light-blue TC-style header with sort arrow.
- Row helpers: `splitName`, `formatSize`, `formatDate`, `formatAttr`, `rowColors`, `ROW_HEIGHT`.

`Panel` in `@bc/ui-rn` consumes this — it owns cursor/marked state and keyboard handling, and delegates list rendering here.
