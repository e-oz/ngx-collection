# Error Handling

## Overview

The collection provides three layers of error handling:

1. **`onError` callbacks** on every method — for immediate, per-operation error handling
2. **Error signals** — for displaying persistent error state in templates
3. **`errReporter`** — for centralized error logging

## `onError` callbacks

Every CRUD method accepts an `onError` callback that is called if the operation fails:

```ts
collection.update({
  request: this.http.put<Product>(`/api/products/${id}`, data),
  item: { id },
  onError: (error) => {
    this.toast.error('Failed to save product');
    console.error(error);
  },
});
```

The callback receives the raw error from the failed Observable (typically an `HttpErrorResponse` from Angular's `HttpClient`).

If the callback itself throws an exception, the exception is caught and reported via `errReporter` (or `console.error` as a fallback).

## Error signals

Read and refresh operations have dedicated error signals that persist until the next call to the same method:

| Signal | Set by | Cleared by |
|---|---|---|
| `$lastReadError` | `read()` on failure | Start of next `read()` call |
| `$lastReadOneError` | `readOne()` on failure | Start of next `readOne()` call |
| `$lastReadManyError` | `readMany()` on failure (total or partial) | Start of next `readMany()` call |
| `$lastRefreshError` | `refresh()` or `refreshMany()` on failure (total or partial) | Start of next `refresh()` or `refreshMany()` call |

### `LastError<T>` structure

Each error signal contains a `LastError` object:

```ts
type LastError<T> = {
  errors: unknown[];   // Array of error(s) that occurred
  time: Date;          // When the error happened
  context?: unknown;   // Optional context value you passed in the params
  items?: Partial<T>[]; // The items involved in the operation (if provided)
};
```

### Using error signals in templates

```html
@if (collection.$lastReadError(); as error) {
  <div class="error-banner">
    Failed to load items at {{ error.time | date:'shortTime' }}.
    <button (click)="reload()">Retry</button>
  </div>
}
```

### The `context` parameter

Every method params type includes an optional `context` field. It's stored in the `LastError` object, so you can pass identifying information for later use:

```ts
collection.read({
  request: this.http.get<Product[]>(`/api/products?category=${categoryId}`),
  context: { categoryId },
  onError: (err) => this.toast.error('Load failed'),
});

// Later, in a template or computed:
const error = collection.$lastReadError();
if (error) {
  console.log('Failed for category:', error.context);
}
```

### Why no error signals for create/update/delete?

Error signals exist only for read and refresh operations because these are the operations where you typically want persistent error display (e.g., "Failed to load data — click to retry"). For create, update, and delete, the `onError` callback is sufficient — you usually show a toast or snackbar that auto-dismisses.

## Centralized error reporting with `errReporter`

The `errReporter` option lets you register a function that receives internal errors and warnings:

```ts
new Collection<Product>({
  comparatorFields: ['id'],
  errReporter: console.error,
});
```

In production, you might route errors to a monitoring service:

```ts
new Collection<Product>({
  comparatorFields: ['id'],
  errReporter: (...args) => this.errorTracker.captureMessage(args.join(' ')),
});
```

When `errReporter` is set, it replaces `console.error` as the default destination for:

- Duplicate detection warnings
- Internal exceptions (e.g., callback errors)
- Runtime warnings

When `errReporter` is **not** set, these messages go to `console.error` as a fallback.

## Partial errors {#partial-errors}

When `*Many` methods (`createMany`, `readMany`, `updateMany`, `deleteMany`, `refreshMany`) receive an **array of requests**, each request runs independently. Some may succeed while others fail:

- **Successful results** are applied to the collection normally.
- **Failed requests** are collected into an array and reported via `onError`.
- For `readMany()` and `refreshMany()`, partial errors are also stored in `$lastReadManyError` / `$lastRefreshError`.
- `onSuccess` is called with the items from the successful requests.

```ts
collection.readMany({
  request: [
    this.http.get<Product>('/api/products/1'),       // succeeds
    this.http.get<Product>('/api/products/999'),      // fails (404)
    this.http.get<Product>('/api/products/3'),        // succeeds
  ],
  onSuccess: (items) => {
    // Called with [product1, product3]
  },
  onError: (errors) => {
    // Called with [HttpErrorResponse for product 999]
  },
});
```

When given a **single request** (not an array), the behavior is the same as any other method — a failure fails the entire operation.

## Duplicate detection

The collection prevents duplicate items (items with the same identity according to the [comparator](comparator.md)). When a duplicate is detected:

1. The duplicate item is **not** added to the collection.
2. `errReporter` is called with details about the duplicate (if set).
3. The `onError` callback is called with the duplicate error parameter.

### Controlling duplicate behavior

**`throwOnDuplicates`** — when set to a string, duplicate detection throws an exception instead of silently reporting:

```ts
new Collection<Product>({
  comparatorFields: ['id'],
  throwOnDuplicates: 'Duplicate product detected!',
});
```

**`allowFetchedDuplicates`** (default: `true`) — controls whether `read()` accepts a response that contains duplicates within itself:

```ts
new Collection<Product>({
  comparatorFields: ['id'],
  allowFetchedDuplicates: false, // read() will reject and clear items on duplicates
});
```

Even when `allowFetchedDuplicates` is `true`, duplicates are still reported to `errReporter` — the response is accepted, but the warning helps you identify data issues.

**`onDuplicateErrCallbackParam`** — the value passed to `onError` when a duplicate is detected. By default, this is a `DuplicateError` instance. You can customize it:

```ts
new Collection<Product>({
  comparatorFields: ['id'],
  onDuplicateErrCallbackParam: 'DUPLICATE',
});

// In your onError callback:
collection.create({
  request: req,
  onError: (err) => {
    if (err === 'DUPLICATE') {
      this.toast.warn('Item already exists');
    } else {
      this.toast.error('Creation failed');
    }
  },
});
```

### `read()` behavior with duplicates

When `read()` receives items containing duplicates:

- If `allowFetchedDuplicates` is `true` (default): items are accepted into the collection, but a warning is sent to `errReporter`.
- If `allowFetchedDuplicates` is `false`: items are rejected, the collection is cleared (unless `keepExistingOnError` is `true`), and `onError` is called.

## Next steps

- [State Signals](state-signals.md) — understanding error signals in context
- [Item Comparison](comparator.md) — how duplicates are detected
- [CRUD Operations](crud-operations.md) — using `onError` in practice
