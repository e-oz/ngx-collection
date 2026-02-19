# Status Management

The collection provides two separate systems for assigning custom statuses to items. Statuses are not predefined — you define your own and the collection manages them.

## Unique statuses

A **unique status** maps to exactly one item at a time. Setting a status on a new item automatically removes it from the previous item. This is ideal for states like "focused", "active", or "editing" where only one item can have the status.

### Setting a unique status

```ts
collection.setUniqueStatus('focused', item);
```

If another item previously had the `'focused'` status, it loses it automatically.

### Unsetting a unique status

You can unset a status from a specific item:

```ts
collection.setUniqueStatus('focused', item, false);
```

This only removes the status if it's currently assigned to that specific item. If a different item has the status, nothing happens.

To remove a status regardless of which item has it:

```ts
collection.deleteUniqueStatus('focused');
```

### Reading unique statuses

The `$status` signal contains a `Map<UniqueStatus, T>`:

```ts
// Get the currently focused item
readonly focusedItem = computed(() => this.collection.$status().get('focused'));
```

In a template:

```html
@if (collection.$status().get('editing'); as editingItem) {
  <app-edit-form [item]="editingItem" />
}
```

### Practical example: focused row in a table

```ts
type TableStatus = 'focused' | 'editing';

class ItemsCollection extends Collection<Item, TableStatus> {
  constructor() {
    super({ comparatorFields: ['id'] });
  }
}

// In a component:
onRowClick(item: Item) {
  this.collection.setUniqueStatus('focused', item);
}

onEditClick(item: Item) {
  this.collection.setUniqueStatus('editing', item);
}

onEditDone() {
  this.collection.deleteUniqueStatus('editing');
}
```

```html
@for (item of collection.$items(); track item.id) {
  <tr
    [class.focused]="collection.$status().get('focused') === item"
    (click)="onRowClick(item)"
  >
    ...
  </tr>
}
```

## Item statuses

An **item status** allows multiple items to have the same status, and each item can have multiple statuses. This is ideal for states like "selected", "highlighted", or "flagged".

### Setting an item status

```ts
collection.setItemStatus(item, 'selected');
```

### Removing an item status

```ts
collection.deleteItemStatus(item, 'selected');
```

### Reading item statuses

The `$statuses` signal contains a `Map<T, Set<Status>>`:

```ts
// Check if a specific item is selected
readonly isSelected = computed(() =>
  this.collection.$statuses().get(this.item)?.has('selected') ?? false
);
```

### Practical example: multi-select list

```ts
type ItemStatus = 'selected' | 'highlighted';

class ItemsCollection extends Collection<Item, unknown, ItemStatus> {
  constructor() {
    super({ comparatorFields: ['id'] });
  }
}

// In a component:
toggleSelection(item: Item) {
  if (this.collection.$statuses().get(item)?.has('selected')) {
    this.collection.deleteItemStatus(item, 'selected');
  } else {
    this.collection.setItemStatus(item, 'selected');
  }
}

readonly selectedItems = computed(() => {
  const selected: Item[] = [];
  for (const [item, statuses] of this.collection.$statuses()) {
    if (statuses.has('selected')) {
      selected.push(item);
    }
  }
  return selected;
});
```

```html
@for (item of collection.$items(); track item.id) {
  <div
    [class.selected]="collection.$statuses().get(item)?.has('selected')"
    (click)="toggleSelection(item)"
  >
    {{ item.name }}
  </div>
}

<p>{{ selectedItems().length }} items selected</p>
```

## Type parameters

The `Collection` class accepts three type parameters:

```ts
Collection<T, UniqueStatus = unknown, Status = unknown>
```

- `T` — the item type
- `UniqueStatus` — the type for unique status keys (e.g., a string union)
- `Status` — the type for item status keys (e.g., a string union)

Providing specific types gives you type safety on status keys:

```ts
type FocusStatus = 'focused' | 'editing';
type SelectionStatus = 'selected' | 'flagged';

class MyCollection extends Collection<Item, FocusStatus, SelectionStatus> {
  constructor() {
    super({ comparatorFields: ['id'] });
  }
}

// Type error: 'unknown_status' is not assignable to 'FocusStatus'
collection.setUniqueStatus('unknown_status', item);
```

## Important note on object identity

Both status systems use the exact object reference to identify items in the Map. This means you must use the same object reference that's in `$items()`:

```ts
// This works — using the actual item from the collection
const item = collection.$items()[0];
collection.setItemStatus(item, 'selected');

// This may not work — a different object with the same data
collection.setItemStatus({ id: 1, name: 'Product' }, 'selected');
```

When items are updated (via `update()`, `read()`, etc.), old references are replaced with new ones, so any statuses attached to the old references will no longer match. Re-apply statuses after updates if needed.

## Next steps

- [State Signals](state-signals.md) — `$status` and `$statuses` signals
- [CRUD Operations](crud-operations.md) — methods that update items
