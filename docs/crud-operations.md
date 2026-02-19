# CRUD Operations

This guide covers every method for creating, reading, updating, and deleting items in a collection.

## Create

### `create(params)`

Adds a new item to the collection. The server response becomes the new item.

```ts
collection.create({
  request: this.http.post<Product>('/api/products', newProductData),
  onSuccess: (product) => this.toast.success(`Created: ${product.name}`),
  onError: (err) => this.toast.error('Creation failed'),
});
```

**Behavior:**

- `$isCreating()` is `true` while the request is in flight.
- If the response item already exists in the collection (same identity), it's treated as a duplicate — the item is not added and `onError` is called with the duplicate error parameter.
- If the response is `null`, nothing is added.

### `createMany(params)`

Adds multiple items. Accepts either a single request returning an array, or an array of individual requests.

```ts
// Single request returning an array
collection.createMany({
  request: this.http.post<Product[]>('/api/products/bulk', productDataList),
  onSuccess: (products) => this.toast.success(`Created ${products.length} items`),
});

// Array of individual requests (run in parallel)
collection.createMany({
  request: [
    this.http.post<Product>('/api/products', data1),
    this.http.post<Product>('/api/products', data2),
  ],
  onError: (errors) => console.error('Some creations failed', errors),
});
```

When given an array of requests, each runs independently — some may succeed while others fail. See [Error Handling](error-handling.md#partial-errors) for details.

---

## Read

The read methods load items into the collection. There are three distinct behaviors:

| Method | Effect on existing items |
|---|---|
| `read()` | **Replaces** all items — the response becomes the new collection |
| `readOne()` | **Upserts** one item into the existing collection |
| `readMany()` | **Upserts** multiple items into the existing collection |

### `read(params)`

Loads a complete set of items, replacing everything currently in the collection.

```ts
collection.read({
  request: this.http.get<Product[]>('/api/products'),
  onSuccess: (products) => console.log(`Loaded ${products.length} products`),
  onError: (err) => this.toast.error('Failed to load products'),
});
```

**Behavior:**

- `$isReading()` is `true` while the request is in flight.
- `$isBeforeFirstRead()` becomes `false` once the request completes (success or failure).
- On error, items are cleared by default. Use `keepExistingOnError: true` to preserve them.
- On error, `$lastReadError` is set with error details.

**Response formats:**

The request can return either a plain array or a `FetchedItems` object:

```ts
// Plain array
collection.read({
  request: this.http.get<Product[]>('/api/products'),
});

// FetchedItems — includes totalCount for pagination
collection.read({
  request: this.http.get<FetchedItems<Product>>('/api/products?page=1'),
  // Response: { items: [...], totalCount: 150 }
});
```

When using `FetchedItems`, the `totalCount` is stored in `$totalCountFetched()` — useful for displaying "Showing 10 of 150 items" or calculating pagination.

### `readOne(params)`

Fetches a single item and upserts it into the existing collection. If an item with the same identity exists, it's replaced; otherwise, the new item is added.

```ts
collection.readOne({
  request: this.http.get<Product>(`/api/products/${id}`),
  item: { id },  // optional — used for tracking in $readingItems
  onError: (err) => this.toast.error('Failed to load product'),
});
```

This is ideal for detail views where you need to ensure an item is in the collection but don't want to reload the entire list.

### `readMany(params)`

Fetches multiple items and upserts them into the existing collection. Existing items with matching identities are replaced; new items are added.

```ts
// Single request returning an array
collection.readMany({
  request: this.http.get<Product[]>('/api/products?page=2'),
  items: currentPageItems,  // optional — used for tracking
});

// Array of individual requests
collection.readMany({
  request: [
    this.http.get<Product>(`/api/products/1`),
    this.http.get<Product>(`/api/products/2`),
  ],
});
```

This is ideal for **pagination** and **infinite scroll**: load page 2 and it merges into the existing items from page 1.

Like `read()`, it also accepts `FetchedItems` responses for totalCount tracking.

---

## Reactive reads

### `readFrom(params)` {#reactive-reads}

Creates a reactive subscription to a source (Observable or Signal). Each time the source emits, `read()` is called with the emitted value — replacing all items.

```ts
// In constructor options:
new Collection<Product>({
  comparatorFields: ['id'],
  readFrom: {
    source: this.productsSignal,  // Signal<Product[]> or Observable<Product[]>
    isReading: this.isLoadingProducts,  // optional external Signal<boolean>
    onError: (err) => this.toast.error('Load failed'),
  },
  injector: this.injector,
});
```

Use this when your data source is a reactive stream (e.g., a WebSocket, a Signal from a parent component, or a store selector). Every emission replaces the collection contents.

If you provide an `isReading` signal, it will be included in the collection's `$isReading()` computation, so loading state from external sources is correctly reflected.

### `readManyFrom(params)`

Same as `readFrom()`, but uses `readMany()` instead of `read()` — items accumulate rather than being replaced on each emission.

```ts
new Collection<Notification>({
  comparatorFields: ['id'],
  readManyFrom: {
    source: this.notificationStream$,
    onError: (err) => console.error('Notification stream error', err),
  },
  injector: this.injector,
});
```

---

## Refresh

### `refresh(params)`

Re-fetches a specific item and upserts the result. Unlike `update()`, this doesn't imply a mutation was made — it's for getting fresh data without triggering "updating" indicators.

```ts
collection.refresh({
  request: this.http.get<Product>(`/api/products/${product.id}`),
  item: product,
  onSuccess: (freshProduct) => console.log('Refreshed', freshProduct.name),
});
```

**Behavior:**

- The item appears in `$refreshingItems()` (not `$updatingItems()`).
- `isItemRefreshing(product)` returns `true` during the refresh.
- On error, `$lastRefreshError` is set.

When to use `refresh()` vs `update()`:
- Use `refresh()` when you want to reload data without implying a user-initiated change (e.g., background refresh, polling).
- Use `update()` when the user has made a change and you're saving it.

The practical difference: `refresh()` uses `$refreshingItems` while `update()` uses `$updatingItems`. This lets you show different UI indicators — a subtle refresh spinner vs a "saving" state that disables controls.

### `refreshMany(params)`

Refreshes multiple items. Supports either a single request or an array of individual requests.

```ts
collection.refreshMany({
  request: [
    this.http.get<Product>(`/api/products/1`),
    this.http.get<Product>(`/api/products/2`),
  ],
  items: [{ id: 1 }, { id: 2 }],
  onError: (errors) => console.error('Some refreshes failed', errors),
});
```

With an array of requests, each can independently succeed or fail. Successful results are applied; failures are reported via `onError` and `$lastRefreshError`.

---

## Update

### `update(params)`

Sends a mutation request and upserts the result into the collection.

```ts
collection.update({
  request: this.http.put<Product>(`/api/products/${product.id}`, changes),
  item: product,
  onSuccess: (updated) => this.toast.success('Saved'),
  onError: (err) => this.toast.error('Save failed'),
});
```

**Behavior:**

- The item appears in `$updatingItems()` during the operation.
- `$isUpdating()` is `true`.
- The response replaces the existing item (or adds it if not found).

**Three update strategies:**

1. **Direct** (default) — the response from the mutation request becomes the new item:

```ts
collection.update({
  request: this.http.put<Product>(`/api/products/${id}`, data),
  item: { id },
});
```

2. **With `refresh`** — after the mutation request completes, a separate refresh request fetches the latest item. The mutation response is ignored; the refresh response becomes the new item. The item stays in `$updatingItems()` until both requests complete, preventing UI flicker:

```ts
collection.update({
  request: this.http.patch(`/api/products/${id}`, { price: 29.99 }),
  item: { id },
  refresh: {
    request: this.http.get<Product>(`/api/products/${id}`),
    item: { id },
    onSuccess: (product) => this.toast.success('Updated'),
  },
});
```

3. **With `refreshRequest`** *(deprecated — use `refresh` instead)* — same concept but with less control.

### `updateMany(params)`

Updates multiple items. Accepts either a single request returning an array, or an array of individual requests.

```ts
collection.updateMany({
  request: this.http.put<Product[]>('/api/products/bulk', updates),
  items: [{ id: 1 }, { id: 2 }],
  onSuccess: (products) => this.toast.success(`Updated ${products.length} items`),
});
```

Supports the same three update strategies as `update()`. When using `refresh`, the refresh runs as `refreshMany()`.

---

## Delete

### `delete(params)`

Removes an item from the collection after the request succeeds.

```ts
collection.delete({
  request: this.http.delete(`/api/products/${product.id}`),
  item: product,
  onSuccess: () => this.toast.success('Deleted'),
  onError: (err) => this.toast.error('Delete failed'),
});
```

**Behavior:**

- The item appears in `$deletingItems()` during the operation.
- `$isDeleting()` is `true`.
- On success, the item is removed from `$items()`.
- The `request` is optional — omitting it performs a local-only removal.

**Consecutive read:**

You can chain a `read()` after deletion to reload the full list:

```ts
collection.delete({
  request: this.http.delete(`/api/products/${product.id}`),
  item: product,
  read: {
    request: this.http.get<FetchedItems<Product>>('/api/products?page=1'),
    onError: (err) => this.toast.error('Reload failed'),
  },
});
```

**Decrementing total count:**

If you track `$totalCountFetched` for pagination, you can decrement it on delete:

```ts
collection.delete({
  request: this.http.delete(`/api/products/${product.id}`),
  item: product,
  decrementTotalCount: true,  // decrement by 1
});
```

`decrementTotalCount` accepts:
- `true` — decrement by 1 (for `delete`) or by the number of deleted items (for `deleteMany`)
- a `number` — decrement by that specific amount
- a `string` — use the named field from the server response as the new total count

### `deleteMany(params)`

Deletes multiple items. Supports an array of requests that run in parallel.

```ts
collection.deleteMany({
  request: [
    this.http.delete(`/api/products/1`),
    this.http.delete(`/api/products/2`),
  ],
  items: [{ id: 1 }, { id: 2 }],
  onSuccess: () => this.toast.success('Deleted'),
  decrementTotalCount: true,
});
```

---

## fetchItem

A convenience method: returns an item if it already exists in the collection, or fetches it if not.

```ts
collection.fetchItem({ id: 42 }, this.http.get<Product>('/api/products/42'))
  .subscribe(product => {
    // product is either from the collection or freshly fetched
  });
```

If `fetchItemRequestFactory` was provided in the constructor options, the second argument is optional:

```ts
const collection = new Collection<Product>({
  comparatorFields: ['id'],
  fetchItemRequestFactory: (item) => this.http.get<Product>(`/api/products/${item.id}`),
});

// Later — no need to provide the request:
collection.fetchItem({ id: 42 });
```

---

## The `item` parameter

Many methods accept an `item` parameter to identify which item in the collection is being operated on. You don't need to pass the full object — a partial with at least one comparator field is enough:

```ts
// Full item (works)
collection.update({ request: req, item: book });

// Partial with ID field (also works)
collection.update({ request: req, item: { id: book.id } });
```

See [Item Comparison](comparator.md) for how items are matched.

## Listening for changes

You can subscribe to notifications when items are created, read, updated, or deleted:

```ts
collection.listenForCreate()   // Observable<T[]> — emits newly created items
collection.listenForRead()     // Observable<T[]> — emits items after read/refresh
collection.listenForUpdate()   // Observable<T[]> — emits items after update
collection.listenForDelete()   // Observable<Partial<T>[]> — emits deleted items
```

For tracking specific items:

```ts
collection.listenForItemsUpdate([{ id: 1 }, { id: 2 }])
  .subscribe(updated => {
    // Emits when any of these items are updated, read, or refreshed
  });

collection.listenForItemsDeletion([{ id: 1 }, { id: 2 }])
  .subscribe(deleted => {
    // Emits when any of these items are deleted
  });
```

## Next steps

- [State Signals](state-signals.md) — all the signals that track operation state
- [Error Handling](error-handling.md) — error callbacks, error signals, and partial failures
- [Item Comparison](comparator.md) — how the library identifies items
