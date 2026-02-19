# API Reference

Concise reference of every public member of the `Collection` class, the `Comparator` class, the `createEffect` function, and the `equalPrimitives` helper. For detailed explanations and examples, follow the links to the relevant guides.

## Collection\<T, UniqueStatus, Status\>

### Constructor

```ts
constructor(options?: CollectionOptions & CollectionOptionsTyped<T>)
```

See [Getting Started](getting-started.md#constructor-options) for common options.

#### `CollectionOptions`

| Option | Type | Description |
|---|---|---|
| `comparatorFields` | `(string \| string[])[]` | Fields used to identify items. See [Item Comparison](comparator.md). |
| `comparator` | `ObjectsComparator \| ObjectsComparatorFn` | Custom comparator — overrides `comparatorFields`. |
| `throwOnDuplicates` | `string \| false` | If set, duplicate detection throws with this message. |
| `allowFetchedDuplicates` | `boolean` | Whether `read()` accepts duplicates in the response (default: `true`). |
| `onDuplicateErrCallbackParam` | `any` | Value passed to `onError` on duplicate detection. |
| `errReporter` | `(...args: any[]) => any` | Error reporting function. See [Error Handling](error-handling.md). |
| `onFirstItemsRequest` | `Function` | Callback fired once when `$items()` is first read. |
| `injector` | `Injector` | Required for `readFrom`/`readManyFrom` outside injection context. |

#### `CollectionOptionsTyped<T>`

| Option | Type | Description |
|---|---|---|
| `readFrom` | `ReadFromParams<T>` | Reactive source for `readFrom()`. See [CRUD Operations](crud-operations.md#reactive-reads). |
| `readManyFrom` | `ReadFromParams<T>` | Reactive source for `readManyFrom()`. |
| `fetchItemRequestFactory` | `(item: T) => Observable<T>` | Factory for `fetchItem()` requests. |

---

### Signals

#### Collection data

| Signal | Type | Guide |
|---|---|---|
| `$items` | `Signal<T[]>` | [State Signals](state-signals.md#collection-data) |
| `$totalCountFetched` | `Signal<number \| undefined>` | [State Signals](state-signals.md#collection-data) |

#### Loading flags

| Signal | Type | Guide |
|---|---|---|
| `$isCreating` | `Signal<boolean>` | [State Signals](state-signals.md#loading-flags) |
| `$isReading` | `Signal<boolean>` | [State Signals](state-signals.md#loading-flags) |
| `$isUpdating` | `Signal<boolean>` | [State Signals](state-signals.md#loading-flags) |
| `$isDeleting` | `Signal<boolean>` | [State Signals](state-signals.md#loading-flags) |
| `$isSaving` | `Signal<boolean>` | [State Signals](state-signals.md#composite-loading-flags) |
| `$isMutating` | `Signal<boolean>` | [State Signals](state-signals.md#composite-loading-flags) |
| `$isProcessing` | `Signal<boolean>` | [State Signals](state-signals.md#composite-loading-flags) |
| `$isBeforeFirstRead` | `Signal<boolean>` | [State Signals](state-signals.md#loading-flags) |

#### Item-level tracking

| Signal | Type | Guide |
|---|---|---|
| `$updatingItems` | `Signal<T[]>` | [State Signals](state-signals.md#item-level-tracking) |
| `$deletingItems` | `Signal<T[]>` | [State Signals](state-signals.md#item-level-tracking) |
| `$refreshingItems` | `Signal<T[]>` | [State Signals](state-signals.md#item-level-tracking) |
| `$readingItems` | `Signal<Partial<T>[]>` | [State Signals](state-signals.md#item-level-tracking) |
| `$mutatingItems` | `Signal<T[]>` | [State Signals](state-signals.md#item-level-tracking) |
| `$processingItems` | `Signal<T[]>` | [State Signals](state-signals.md#item-level-tracking) |

#### Error signals

| Signal | Type | Guide |
|---|---|---|
| `$lastReadError` | `Signal<LastError<T> \| undefined>` | [Error Handling](error-handling.md#error-signals) |
| `$lastReadOneError` | `Signal<LastError<T> \| undefined>` | [Error Handling](error-handling.md#error-signals) |
| `$lastReadManyError` | `Signal<LastError<T> \| undefined>` | [Error Handling](error-handling.md#error-signals) |
| `$lastRefreshError` | `Signal<LastError<T> \| undefined>` | [Error Handling](error-handling.md#error-signals) |

#### Status signals

| Signal | Type | Guide |
|---|---|---|
| `$status` | `Signal<Map<UniqueStatus, T>>` | [Status Management](status-management.md#unique-statuses) |
| `$statuses` | `Signal<Map<T, Set<Status>>>` | [Status Management](status-management.md#item-statuses) |

---

### CRUD methods

All CRUD methods return an Observable. The returned Observable must be subscribed to for the operation to execute — use `createEffect()` or subscribe explicitly.

#### `create(params: CreateParams<T>): Observable<T>`

Add a new item. See [CRUD Operations](crud-operations.md#create).

```ts
type CreateParams<T> = {
  request: Observable<T> | Signal<T>;
  onSuccess?: (item: T) => void;
  onError?: (error: unknown) => void;
  context?: unknown;
}
```

#### `createMany(params: CreateManyParams<T>): Observable<T[] | FetchedItems<T>>`

Add multiple items. See [CRUD Operations](crud-operations.md#createmanyparams).

```ts
type CreateManyParams<T> = {
  request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  onSuccess?: (items: T[]) => void;
  onError?: (error: unknown) => void;
  context?: unknown;
}
```

#### `read(params: ReadParams<T>): Observable<T[] | FetchedItems<T>>`

Replace all items. See [CRUD Operations](crud-operations.md#read).

```ts
type ReadParams<T> = {
  request: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  onSuccess?: (items: T[]) => void;
  onError?: (error: unknown) => void;
  keepExistingOnError?: boolean;
  items?: Partial<T>[];
  context?: unknown;
}
```

#### `readOne(params: ReadOneParams<T>): Observable<T>`

Upsert a single item. See [CRUD Operations](crud-operations.md#readoneparams).

```ts
type ReadOneParams<T> = {
  request: Observable<T> | Signal<T>;
  onSuccess?: (item: T) => void;
  onError?: (error: unknown) => void;
  item?: Partial<T>;
  context?: unknown;
}
```

#### `readMany(params: ReadManyParams<T>): Observable<T[] | FetchedItems<T>>`

Upsert multiple items. See [CRUD Operations](crud-operations.md#readmanyparams).

```ts
type ReadManyParams<T> = {
  request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  onSuccess?: (items: T[]) => void;
  onError?: (error: unknown) => void;
  items?: Partial<T>[];
  context?: unknown;
}
```

#### `readFrom(params: ReadFromParams<T>): Observable<FetchedItems<T> | T[]>`

Reactive `read()` from a source. See [CRUD Operations](crud-operations.md#reactive-reads).

```ts
type ReadFromParams<T> = {
  source: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  isReading?: Signal<boolean>;
  onSuccess?: (items: T[]) => void;
  onError?: (error: unknown) => void;
  keepExistingOnError?: boolean;
  items?: Partial<T>[];
  context?: unknown;
}
```

#### `readManyFrom(params: ReadFromParams<T>): Observable<FetchedItems<T> | T[]>`

Reactive `readMany()` from a source. See [CRUD Operations](crud-operations.md#readmanyfromparams).

#### `refresh(params: RefreshParams<T>): Observable<T>`

Re-fetch a single item. See [CRUD Operations](crud-operations.md#refresh).

```ts
type RefreshParams<T> = {
  request: Observable<T> | Signal<T>;
  item: Partial<T>;
  onSuccess?: (item: T) => void;
  onError?: (error: unknown) => void;
  context?: unknown;
}
```

#### `refreshMany(params: RefreshManyParams<T>): Observable<T[] | FetchedItems<T>>`

Re-fetch multiple items. See [CRUD Operations](crud-operations.md#refreshmanyparams).

```ts
type RefreshManyParams<T> = {
  request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  items: Partial<T>[];
  onSuccess?: (items: T[]) => void;
  onError?: (error: unknown) => void;
  context?: unknown;
}
```

#### `update(params: UpdateParams<T>): Observable<T>`

Update/upsert a single item. See [CRUD Operations](crud-operations.md#update).

```ts
type UpdateParams<T> = {
  request: Observable<T> | Signal<T>;
  item: Partial<T>;
  refresh?: RefreshParams<T>;
  refreshRequest?: Observable<T> | Signal<T>;  // deprecated
  onSuccess?: (item: T) => void;
  onError?: (error: unknown) => void;
  context?: unknown;
}
```

#### `updateMany(params: UpdateManyParams<T>): Observable<T[] | FetchedItems<T>>`

Update multiple items. See [CRUD Operations](crud-operations.md#updatemanyparams).

```ts
type UpdateManyParams<T> = {
  request: Observable<T[]> | Observable<T>[] | Signal<T[]> | Signal<T>[];
  items: Partial<T>[];
  refresh?: RefreshManyParams<T>;
  refreshRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;  // deprecated
  onSuccess?: (items: T[]) => void;
  onError?: (error: unknown) => void;
  context?: unknown;
}
```

#### `delete<R = unknown>(params: DeleteParams<T, R>): Observable<R>`

Remove a single item. See [CRUD Operations](crud-operations.md#delete).

```ts
type DeleteParams<T, R = unknown> = {
  request?: Observable<R> | Signal<R> | null;
  item: Partial<T>;
  decrementTotalCount?: boolean | number | string;
  read?: ReadParams<T>;
  readRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;  // deprecated
  onSuccess?: (response: R) => void;
  onError?: (error: unknown) => void;
  context?: unknown;
}
```

#### `deleteMany<R = unknown>(params: DeleteManyParams<T, R>): Observable<R[]>`

Remove multiple items. See [CRUD Operations](crud-operations.md#deletemanyparams).

```ts
type DeleteManyParams<T, R = unknown> = {
  request?: Observable<R> | Observable<R>[] | Signal<R> | Signal<R>[] | null;
  items: Partial<T>[];
  decrementTotalCount?: boolean | number | string;
  read?: ReadParams<T>;
  readRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;  // deprecated
  onSuccess?: (response: R[]) => void;
  onError?: (error: unknown) => void;
  context?: unknown;
}
```

#### `fetchItem(itemPartial: Partial<T>, request?: Observable<T>): Observable<T>`

Get-or-create an item. See [CRUD Operations](crud-operations.md#fetchitem).

---

### Item comparison methods

See [Item Comparison](comparator.md) for details.

| Method | Signature | Description |
|---|---|---|
| `hasItemIn` | `(item: Partial<T>, arr: Partial<T>[]): boolean` | Check if item exists in array |
| `uniqueItems` | `(items: N[]): N[]` | Deduplicate an array |
| `getItem` | `(filter, equalFn?): Signal<T \| undefined>` | Reactive item lookup by partial |
| `getItemByField` | `(field, fieldValue, equalFn?): Signal<T \| undefined>` | Reactive item lookup by field value |
| `getItemByPartial` | `(partItem, items?): T \| undefined` | Find item by partial (non-reactive) |
| `getDuplicates` | `(items: T[]): DuplicatesMap<T> \| null` | Find all duplicates in an array |
| `idsToPartialItems` | `(ids: unknown[], field: string): Partial<T>[]` | Convert IDs to partial items |

---

### Status methods

See [Status Management](status-management.md) for details.

| Method | Signature | Description |
|---|---|---|
| `setUniqueStatus` | `(status, item, active?): void` | Set/unset a unique status |
| `deleteUniqueStatus` | `(status): void` | Remove a unique status |
| `setItemStatus` | `(item, status): void` | Add a status to an item |
| `deleteItemStatus` | `(item, status): void` | Remove a status from an item |

---

### Per-item signal factories

See [State Signals](state-signals.md#per-item-signal-factories) for details.

| Method | Signature |
|---|---|
| `isItemDeleting` | `(itemSource: Partial<T> \| Signal<Partial<T> \| undefined>): Signal<boolean>` |
| `isItemRefreshing` | `(itemSource: Partial<T> \| Signal<Partial<T> \| undefined>): Signal<boolean>` |
| `isItemUpdating` | `(itemSource: Partial<T> \| Signal<Partial<T> \| undefined>): Signal<boolean>` |
| `isItemMutating` | `(itemSource: Partial<T> \| Signal<Partial<T> \| undefined>): Signal<boolean>` |
| `isItemReading` | `(itemSource: Partial<T> \| Signal<Partial<T> \| undefined>): Signal<boolean>` |
| `isItemProcessing` | `(itemSource: Partial<T> \| Signal<Partial<T> \| undefined>): Signal<boolean>` |

---

### Configuration methods

| Method | Signature | Description |
|---|---|---|
| `setComparator` | `(comparator: ObjectsComparator \| ObjectsComparatorFn): void` | Replace the comparator |
| `setOptions` | `(options?: CollectionOptions \| null): void` | Set multiple options at once |
| `setThrowOnDuplicates` | `(message: string \| undefined): void` | Configure duplicate exception |
| `setAllowFetchedDuplicates` | `(allow: boolean): void` | Configure fetched duplicate behavior |
| `setOnDuplicateErrCallbackParam` | `(param: any): void` | Configure duplicate error callback value |
| `setOnFirstItemsRequest` | `(cb: Function \| undefined): void` | Set lazy-init callback for `$items` |

---

### Event listeners

| Method | Returns | Emits when... |
|---|---|---|
| `listenForCreate()` | `Observable<T[]>` | Items are created |
| `listenForRead()` | `Observable<T[]>` | Items are read or refreshed |
| `listenForUpdate()` | `Observable<T[]>` | Items are updated |
| `listenForDelete()` | `Observable<Partial<T>[]>` | Items are deleted |
| `listenForItemsUpdate(items)` | `Observable<T[]>` | Specific items are updated/read/refreshed |
| `listenForItemsDeletion(items)` | `Observable<Partial<T>[]>` | Specific items are deleted |

---

### Overridable lifecycle methods

| Method | Called from | Description |
|---|---|---|
| `init()` | Constructor (synchronously) | Override for custom initialization. No need to call `super.init()`. |
| `asyncInit()` | Constructor (next microtask, after `init()`) | Override for async initialization. No need to call `super.asyncInit()`. |

---

## Comparator

```ts
import { Comparator } from 'ngx-collection';
```

```ts
class Comparator implements ObjectsComparator {
  constructor(fields?: (string | string[])[]);
  equal(obj1: unknown, obj2: unknown, byFields?: (string | string[])[]): boolean;
}
```

See [Item Comparison](comparator.md) for detailed behavior.

---

## createEffect

```ts
import { createEffect } from 'ngx-collection';
```

```ts
function createEffect<ProvidedType = void>(
  generator: (origin$: Observable<ProvidedType>, callbacks: EffectCallbacks) => Observable<unknown>,
  options?: CreateEffectOptions
): EffectFunction & EffectMethods<ProvidedType>;
```

See [createEffect](create-effect.md) for detailed usage.

#### `CreateEffectOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `injector` | `Injector` | Current injection context | Required outside injection context |
| `retryOnError` | `boolean \| RetryConfig` | `true` | Auto-retry on generator error |

#### `EffectCallbacks`

| Method | Description |
|---|---|
| `success(value?)` | Triggers `onSuccess` and `onFinalize` listeners |
| `error(error?)` | Triggers `onError` and `onFinalize` listeners |

#### `EffectListeners`

| Callback | Triggered by |
|---|---|
| `next` | Generator emits a value |
| `onSuccess` | `callbacks.success()` called |
| `error` | Generator subscription errors |
| `onError` | `callbacks.error()` called, or generator throws with `retryOnError` |
| `complete` | Generator subscription completes |
| `onFinalize` | `callbacks.success()` or `callbacks.error()` called |

---

## Types

### `FetchedItems<T>`

```ts
type FetchedItems<T> = {
  items: T[];
  totalCount?: number;
}
```

### `LastError<T>`

```ts
type LastError<T> = {
  errors: unknown[];
  time: Date;
  context?: unknown;
  items?: Partial<T>[];
}
```

### `DuplicatesMap<T>`

```ts
type DuplicatesMap<T> = Record<number, Record<number, T>>;
```

### `ObjectsComparator`

```ts
type ObjectsComparator = {
  equal: ObjectsComparatorFn;
}
```

### `ObjectsComparatorFn`

```ts
type ObjectsComparatorFn<T = any> = (obj1: T, obj2: T) => boolean;
```

---

## Standalone helpers

### `equalPrimitives<T>(a: T, b: T): boolean`

A `ValueEqualityFn` that considers only primitive values equal (via `Object.is`). Objects and arrays are always considered non-equal. Useful as an `equal` option for signals containing mutable structures:

```ts
import { equalPrimitives } from 'ngx-collection';

const count = signal(0, { equal: equalPrimitives });
```

### `DuplicateError`

An `Error` subclass used as the default `onDuplicateErrCallbackParam`. You can check `instanceof DuplicateError` in your `onError` callbacks to distinguish duplicate errors from other errors.

```ts
import { DuplicateError } from 'ngx-collection';

collection.create({
  request: req,
  onError: (err) => {
    if (err instanceof DuplicateError) {
      // handle duplicate
    }
  },
});
```
