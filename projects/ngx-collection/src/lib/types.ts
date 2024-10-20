import { type Injector, Signal, ValueEqualityFn } from '@angular/core';
import { Observable } from 'rxjs';
import { ObjectsComparator, ObjectsComparatorFn } from './comparator';

export type FetchedItems<T> = {
  items: T[];
  totalCount?: number;
}

export type CreateParams<T> = {
  readonly request: Observable<T> | Signal<T>;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
  readonly context?: unknown;
}

export type CreateManyParams<T> = {
  readonly request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  readonly onSuccess?: (items: T[]) => void;
  readonly onError?: (error: unknown) => void;
  readonly context?: unknown;
}

export type ReadParams<T> = {
  readonly request: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  readonly onSuccess?: (items: T[]) => void;
  readonly onError?: (error: unknown) => void;
  readonly keepExistingOnError?: boolean;
  readonly items?: Partial<T>[];
  readonly context?: unknown;
}

export type ReadOneParams<T> = {
  readonly request: Observable<T> | Signal<T>;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
  readonly item?: Partial<T>;
  readonly context?: unknown;
}

export type ReadManyParams<T> = {
  readonly request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  readonly onSuccess?: (items: T[]) => void;
  readonly onError?: (error: unknown) => void;
  readonly items?: Partial<T>[];
  readonly context?: unknown;
}

export type ReadFromParams<T> = Omit<ReadParams<T>, 'request'> & {
  readonly source: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
};


export type UpdateParams<T> = {
  readonly request: Observable<T> | Signal<T>;
  /**
   * You can optionally set `refresh` to provide an observable that will be used to get the new item:
   * If `refresh` is set, `request` returned item will be ignored (but the request itself will be executed), and the result of the `refresh` will become a new value of an item.
   * Item will be removed from `updatingItems`, `mutatingItems` only after executing both requests - to prevent spinners from flickering.
   */
  readonly refresh?: RefreshParams<T>;
  /**
   * @deprecated Use `refresh` instead. will be removed in v5.
   */
  readonly refreshRequest?: Observable<T> | Signal<T>;
  readonly item: Partial<T>;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
  readonly context?: unknown;
}

export type UpdateManyParams<T> = {
  readonly request: Observable<T[]> | Observable<T>[] | Signal<T[]> | Signal<T>[];
  readonly refresh?: RefreshManyParams<T>;
  /**
   * @deprecated Use `refresh` instead. will be removed in v5.
   */
  readonly refreshRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  readonly items: Partial<T>[];
  readonly onSuccess?: (item: T[]) => void;
  readonly onError?: (error: unknown) => void;
  readonly context?: unknown;
}

export type DeleteParams<T, R = unknown> = {
  readonly request?: Observable<R> | Signal<R> | null;
  readonly item: Partial<T>;
  /**
   * If `decrementTotalCount` is provided AND if `read` is empty:
   *   boolean: decrement `totalCountFetched` by 1 (if current totalCountFetched > 0);
   *   number: decrement `totalCountFetched` by number (should be integer, less or equal to the current value of `totalCountFetched`);
   *   string: points what field of the response object should be used (if exist) as a source of `totalCountFetched` (should be integer, >= 0).
   */
  readonly decrementTotalCount?: boolean | number | string;
  /**
   * Consecutive read() request.
   * If provided, it will be the source of the new set of items (decrementTotalCount will be ignored).
   */
   readonly read?: ReadParams<T>;
  /**
   * @deprecated Use `read()` instead. will be removed in v5.
   */
  readonly readRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  readonly onSuccess?: (response: R) => void;
  readonly onError?: (error: unknown) => void;
  readonly context?: unknown;
}

export type DeleteManyParams<T, R = unknown> = {
  readonly request?: Observable<R> | Observable<R>[] | Signal<R> | Signal<R>[] | null;
  readonly items: Partial<T>[];
  /**
   * If `decrementTotalCount` is provided AND if `read` is empty:
   *   boolean: decrement `totalCountFetched` by number of removed items (if resulting `totalCountFetched` >= 0);
   *   number: decrement `totalCountFetched` by number (should be integer, less or equal to the current value of `totalCountFetched`);
   *   string: points what field of the response object (first one, if it's an array) should be used (if exist) as a source of `totalCountFetched` (should be integer, >= 0).
   */
  readonly decrementTotalCount?: boolean | number | string;
  /**
   * Consecutive read() request.
   * If provided, it will be the source of the new set of items (decrementTotalCount will be ignored).
   */
   readonly read?: ReadParams<T>;
  /**
   * @deprecated Use `read()` instead. will be removed in v5.
   */
  readonly readRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  readonly onSuccess?: (response: R[]) => void;
  readonly onError?: (error: unknown) => void;
  readonly context?: unknown;
}

export type RefreshParams<T> = {
  readonly request: Observable<T> | Signal<T>;
  readonly item: Partial<T>;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
  readonly context?: unknown;
}

export type RefreshManyParams<T> = {
  readonly request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  readonly items: Partial<T>[];
  readonly onSuccess?: (item: T[]) => void;
  readonly onError?: (error: unknown) => void;
  readonly context?: unknown;
}

export type DuplicatesMap<T> = Record<number, Record<number, T>>;

export type CollectionOptions = {
  /**
   * List of "id" fields
   */
  comparatorFields?: (string | string[])[];
  /**
   * Custom comparator - will override `comparatorFields` if set
   */
  comparator?: ObjectsComparator | ObjectsComparatorFn;
  /**
   * If set, duplicates detection will throw an exception with this value as an argument
   */
  throwOnDuplicates?: string | false;
  /**
   * if not set: true
   */
  allowFetchedDuplicates?: boolean;
  /**
   * in case of duplicate detection, `onError` callback function (if provided) will be called with this value as an argument
   */
  onDuplicateErrCallbackParam?: any;
  /**
   * print errors. Example: ` errReporter: environment.production ? undefined : console.error `
   */
  errReporter?: (...args: any[]) => any;
  /**
   * @see CollectionInterface.setOnFirstItemsRequest
   */
  onFirstItemsRequest?: Function;
  injector?: Injector;
}

export type CollectionOptionsTyped<T> = {
  /**
   * Will subscribe to the Observable returned by `readFrom` method.
   * If called not in an injection context, will require `injector` option
   * to be set, otherwise will throw an error.
   * @see CollectionInterface.readFrom
   */
  readFrom?: ReadFromParams<T>;
  /**
   * Will subscribe to the Observable returned by `readManyFrom` method.
   * If called not in an injection context, will require `injector` option
   * to be set, otherwise will throw an error.
   * @see CollectionInterface.readManyFrom
   */
  readManyFrom?: ReadFromParams<T>;
  /**
   * Function that should return an Observable, that will be used to fetch a
   * single item using `fetchItem()` method. When this option is
   * set, `fetchItem()` can be called without `request` argument.
   * @see CollectionInterface.fetchItem
   */
  fetchItemRequestFactory?: (item: T) => Observable<T>;
}

export type CollectionInterface<T, UniqueStatus = unknown, Status = unknown> = {
  $items: Signal<T[]>;
  $totalCountFetched: Signal<number | undefined>;

  $updatingItems: Signal<T[]>;
  $deletingItems: Signal<T[]>;
  $refreshingItems: Signal<T[]>;
  $mutatingItems: Signal<T[]>;
  $processingItems: Signal<T[]>;

  $lastReadError: Signal<LastError<T> | undefined>;
  $lastReadOneError: Signal<LastError<T> | undefined>;
  $lastReadManyError: Signal<LastError<T> | undefined>;
  $lastRefreshError: Signal<LastError<T> | undefined>;

  $isCreating: Signal<boolean>;
  $isReading: Signal<boolean>;
  $isUpdating: Signal<boolean>;
  $isDeleting: Signal<boolean>;
  $isMutating: Signal<boolean>;
  $isSaving: Signal<boolean>;
  $isProcessing: Signal<boolean>;
  /**
   * Initialized with 'true', will be set to `false` after
   * the first execution of `read()`, `readOne()`, or `readMany()`.
   * It is designed to be used with 'Not entries found' placeholders.
   */
  $isBeforeFirstRead: Signal<boolean>;

  $readingItems: Signal<Partial<T>[]>;
  $status: Signal<Map<UniqueStatus, T>>;
  $statuses: Signal<Map<T, Set<Status>>>;

  /**
   * Add a new item to the collection.
   */
  create(params: CreateParams<T>): Observable<T>;

  /**
   * Like `create()`, but will run multiple requests in parallel.
   */
  createMany(params: CreateManyParams<T>): Observable<T[] | FetchedItems<T>>;

  /**
   * Create a new collection from provided items.
   * @param params
   */
  read(params: ReadParams<T>): Observable<T[] | FetchedItems<T>>;

  /**
   * Read and update/add one item.
   * Will toggle `isReading` state field of the collection.
   * Designed to be used in components with no guarantee that the item is already fetched from the server (and, therefore, needs to fetch the item first).
   */
  readOne(params: ReadOneParams<T>): Observable<T>;

  /**
   * Read and add a set of items to the collection.
   * Existing items will be updated.
   * Will toggle `isReading` state field of the collection.
   * Designed to be used for pagination or infinite scroll.
   */
  readMany(params: ReadManyParams<T>): Observable<T[] | FetchedItems<T>>;

  /**
   * @experimental
   * Experimental! Not production ready. API might be changed in the future.
   *
   * Will pass to `read()` every emission of `params.source`.
   * Use this, when you want to create a collection, reactively re-created
   * every time `params.source` emits (all the existing items will be
   * removed on every emission, because that's what `read()` does).
   */
  readFrom(params: ReadFromParams<T>): Observable<FetchedItems<T> | T[]>;

  /**
   * @experimental
   * Experimental! Not production ready. API might be changed in the future.
   *
   * Same as `readFrom()`, but the existing items will not be removed (and will be updated).
   */
  readManyFrom(params: ReadFromParams<T>): Observable<FetchedItems<T> | T[]>;

  /**
   * Item will be updated without adding it to `updating` or `mutating` lists, and __without__ toggling `isReading` state field of the collection.
   * Item will be added to the `refreshing` list, triggering modifications of related state fields.
   * Designed to be used for "reloading" the item data without triggering "disabled" statuses of controls.
   */
  refresh(params: RefreshParams<T>): Observable<T>;

  /**
   * Like `refresh()`, but for multiple items. Requests will run in parallel.
   */
  refreshMany(params: RefreshManyParams<T>): Observable<T[] | FetchedItems<T>>;

  /**
   * This method replaces the existing item with the new one. If no existing item is found, a new one will be added.
   */
  update(params: UpdateParams<T>): Observable<T>;

  /**
   * Like `update()`, but for multiple items. Requests will run in parallel.
   * Consecutive `refreshRequest` (if set) will be executed using `refreshMany()`.
   */
  updateMany(params: UpdateManyParams<T>): Observable<T[] | FetchedItems<T>>;

  /**
   * Remove an item from the collection.
   */
  delete<R = unknown>(params: DeleteParams<T, R>): Observable<R>;

  /**
   * Like `delete()`, but will run multiple queries in parallel.
   */
  deleteMany<R = unknown>(params: DeleteManyParams<T, R>): Observable<R[]>;

  /**
   * This method will check if the item exists in the collection and return it if it does.
   * If the item does not exist, the `request` argument will be used to fetch the item and add it to the collection.
   * If the option `fetchItemRequestFactory` is set, the `request` argument is optional.
   * If both are missing, the resulting Observable will throw an error.
   */
  fetchItem(itemPartial: Partial<T>, request?: Observable<T>): Observable<T>;

  /**
   * Checks if some item belongs to some array of items - a comparator of this collection will be used.
   *
   * Example of usage:
   * ```html
   *
   * <mat-chip-option
   *     *ngFor="let role of $.allRoles"
   *     [value]="role"
   *     [selected]="collection.hasItemIn(role, $.roles)"
   *     [selectable]="false"
   * >
   * <span>{{role.name}}</span>
   * </mat-chip-option>
   *
   * ```
   */
  hasItemIn(item: Partial<T>, arr: Partial<T>[]): boolean;

  uniqueItems<N = T | Partial<T>>(items: N[]): N[];

  /**
   * Set the status for an item.
   * Only one item in the collection can have this status.
   * Designed to be used with statuses like 'focused', 'expanded', and so on.
   *
   * @param status - any value (including objects, will be used as a key in a Map)
   * @param item
   * @param active - if the status is active for this particular item. `boolean`, optional, `true` by default. If set to `false`, __and__ this status currently is assigned to this item, then the status will be removed.
   */
  setUniqueStatus(status: UniqueStatus, item: T, active: boolean): void;

  /**
   * Removes unique status.
   * No items will be associated with this status after this call.
   */
  deleteUniqueStatus(status: UniqueStatus): void;

  /**
   * Set the status of the item.
   */
  setItemStatus(item: T, status: Status): void;

  /**
   * Removes the status of the item.
   */
  deleteItemStatus(item: T, status: Status): void;

  /**
   * Check if item is being deleted currently (will be modified dynamically)
   */
  isItemDeleting(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean>;

  /**
   * Check if item is being refreshed currently (will be modified dynamically)
   */
  isItemRefreshing(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean>;

  /**
   * Check if item is being updated currently (will be modified dynamically)
   */
  isItemUpdating(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean>;

  /**
   * Check if item is being updated or deleted currently (will be modified dynamically)
   */
  isItemMutating(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean>;

  /**
   * Check if item is being read currently (will be modified dynamically)
   */
  isItemReading(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean>;

  /**
   * Check if item is being refreshed, updated or deleted currently (will be modified dynamically)
   */
  isItemProcessing(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean>;

  /**
   * Helpers
   */

  /**
   * Set custom Comparator
   */
  setComparator(comparator: ObjectsComparator | ObjectsComparatorFn): void;

  getDuplicates(items: T[]): DuplicatesMap<T> | null;

  getItemByPartial(partItem: Partial<T>, items: T[]): T | undefined;

  /**
   * Set message for an error that will be thrown on duplicates error.
   */
  setThrowOnDuplicates(message: string | undefined): void;

  /**
   * If duplicates should be allowed in "read" methods.
   */
  setAllowFetchedDuplicates(allowFetchedDuplicates: boolean): void;

  /**
   * Set custom argument which should be passed to onDuplicateErr callback function.
   */
  setOnDuplicateErrCallbackParam(onDuplicateErrCallbackParam: any): void;

  /**
   * Callback function will be called once: after $items() signal is read for the first time.
   * It will be called asynchronously, in the next microtask.
   * You can mutate collection in this handler function.
   * Thrown exceptions will not mark the $items() signal as erroneous.
   */
  setOnFirstItemsRequest(cb: Function | undefined): void;

  /**
   * Set multiple options at once. Useful during initialization.
   */
  setOptions(options?: CollectionOptions | null): void;

  /**
   * Get an observable to be notified when new items are created.
   * @returns items that were returned by the `request` observable
   */
  listenForCreate(): Observable<T[]>;

  /**
   * Get an observable to be notified when items are read (will also emit on `refresh` reads).
   * @returns items that were returned by the `request` observable
   */
  listenForRead(): Observable<T[]>;

  /**
   * Get an observable to be notified when some items are updated.
   * @returns items that were returned by the `request` observable
   */
  listenForUpdate(): Observable<T[]>;

  /**
   * Get an observable to be notified when some items are deleted.
   * @returns items that were provided in params
   */
  listenForDelete(): Observable<Partial<T>[]>;

  /**
   * Get an observable to be notified when some particular items
   * are replaced by the new versions (updated, read or refreshed).
   */
  listenForItemsUpdate(items: Partial<T>[]): Observable<T[]>;

  /**
   * Get an observable to be notified when some particular items are deleted.
   */
  listenForItemsDeletion(items: Partial<T>[]): Observable<Partial<T>[]>;

  /**
   * Creates a signal containing an item. Returned signal will be updated every time `filter` is updated.
   * @param filter - (partial) item to be compared with. Also accepts observables and signals.
   * @param equalFn - equality check function (Angular will use its default one if this param is `undefined`)
   */
  getItem(
    filter: Partial<T> | undefined | Signal<Partial<T> | undefined>,
    equalFn: ValueEqualityFn<T | undefined> | undefined
  ): Signal<T | undefined>;

  /**
   * Creates a signal containing an item. Returned signal will be updated every time `fieldValue` is updated.
   * @param field - one field or array of the fields, that item can have (type-checked).
   * @param fieldValue - value (type-checked), also accepts observables and signals.
   * @param equalFn - equality check function (Angular will use its default one if this param is `undefined`)
   */
  getItemByField<K extends keyof T>(
    field: K | K[],
    fieldValue: T[K] | Signal<T[K] | undefined>,
    equalFn: ValueEqualityFn<T | undefined> | undefined
  ): Signal<T | undefined>;

  idsToPartialItems(ids: unknown[], field: string): Partial<T>[];
}

export type LastError<T> = {
  errors: unknown[],
  time: Date,
  context?: unknown,
  items?: Partial<T>[],
}