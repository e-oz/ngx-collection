import { Observable } from 'rxjs';
import { Signal } from '@angular/core';
import { ObjectsComparator, ObjectsComparatorFn } from './comparator';

export type CollectionState<T, UniqueStatus = any, Status = any> = {
  readonly items: T[];
  readonly totalCountFetched?: number;
  readonly isCreating: boolean;
  readonly isReading: boolean;
  readonly updatingItems: T[];
  readonly deletingItems: T[];
  readonly refreshingItems: T[];
  readonly status: Map<UniqueStatus, T>;
  readonly statuses: Map<T, Set<Status>>;
}

export type FetchedItems<T> = {
  items: T[];
  totalCount?: number;
}

export type CreateParams<T> = {
  readonly request: Observable<T> | Signal<T>;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
}

export type CreateManyParams<T> = {
  readonly request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  readonly onSuccess?: (items: T[]) => void;
  readonly onError?: (error: unknown) => void;
}

export type ReadParams<T> = {
  readonly request: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  readonly onSuccess?: (items: T[]) => void;
  readonly onError?: (error: unknown) => void;
  readonly keepExistingOnError?: boolean;
}

export type ReadOneParams<T> = {
  readonly request: Observable<T> | Signal<T>;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
}

export type ReadManyParams<T> = {
  readonly request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  readonly onSuccess?: (items: T[]) => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * You can optionally set `refreshRequest` to provide an observable that will be used to get the new item:
 * If `refreshRequest` is set, `request` returned item will be ignored (but the request itself will be sent), and the result of the `refreshRequest` will become a new value of an item.
 * Item will be removed from `updatingItems`, `mutatingItems` only after executing both requests - to prevent spinners from flickering.
 */
export type UpdateParams<T> = {
  readonly request: Observable<T> | Signal<T>;
  readonly refreshRequest?: Observable<T> | Signal<T>;
  readonly item: Partial<T>;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
}

export type UpdateManyParams<T> = {
  readonly request: Observable<T[]> | Observable<T>[] | Signal<T[]> | Signal<T>[];
  readonly refreshRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  readonly items: Partial<T>[];
  readonly onSuccess?: (item: T[]) => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * If `decrementTotalCount` is provided (and `readRequest` is not provided):
 * * `boolean`: decrement `totalCountFetched` by 1 (if current totalCountFetched > 0);
 * * `number`: decrement `totalCountFetched` by number (should be integer, less or equal to the current value of `totalCountFetched`);
 * * `string`: points what field of the response object should be used (if exist) as a source of `totalCountFetched` (should be integer, >= 0).
 *
 * If `readRequest` is provided, it will be the source of the new set of items (decrementTotalCount will be ignored).
 */
export type DeleteParams<T, R = unknown> = {
  readonly request: Observable<R> | Signal<R>;
  readonly item: Partial<T>;
  /**
   * If `decrementTotalCount` is provided (and `readRequest` is not provided):
   * boolean: decrement `totalCountFetched` by 1 (if current totalCountFetched > 0);
   * number: decrement `totalCountFetched` by number (should be integer, less or equal to the current value of `totalCountFetched`);
   * string: points what field of the response object should be used (if exist) as a source of `totalCountFetched` (should be integer, >= 0).
   */
  readonly decrementTotalCount?: boolean | number | string;
  /**
   * Consecutive read() request.
   * If provided, it will be the source of the new set of items (decrementTotalCount will be ignored).
   */
  readonly readRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  readonly onSuccess?: (response: R) => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * If `decrementTotalCount` is provided (and `readRequest` is not provided):
 * `boolean`: decrement `totalCountFetched` by number of removed items (if resulting `totalCountFetched` >= 0);
 * `number`: decrement `totalCountFetched` by number (should be integer, less or equal to the current value of `totalCountFetched`);
 * `string`: points what field of the response object (first one, if it's an array) should be used (if exist) as a source of `totalCountFetched` (should be integer, >= 0).
 */
export type DeleteManyParams<T, R = unknown> = {
  readonly request: Observable<R> | Observable<R>[] | Signal<R> | Signal<R>[];
  readonly items: Partial<T>[];
  /**
   * If `decrementTotalCount` is provided (and `readRequest` is not provided):
   * boolean: decrement `totalCountFetched` by number of removed items (if resulting `totalCountFetched` >= 0);
   * number: decrement `totalCountFetched` by number (should be integer, less or equal to the current value of `totalCountFetched`);
   * string: points what field of the response object (first one, if it's an array) should be used (if exist) as a source of `totalCountFetched` (should be integer, >= 0).
   */
  readonly decrementTotalCount?: boolean | number | string;
  /**
   * Consecutive read() request.
   * If provided, it will be the source of the new set of items (decrementTotalCount will be ignored).
   */
  readonly readRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  readonly onSuccess?: (response: R[]) => void;
  readonly onError?: (error: unknown) => void;
}

export type RefreshParams<T> = {
  readonly request: Observable<T> | Signal<T>;
  readonly item: Partial<T>;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
}

export type RefreshManyParams<T> = {
  readonly request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  readonly items: Partial<T>[];
  readonly onSuccess?: (item: T[]) => void;
  readonly onError?: (error: unknown) => void;
}

export type DuplicatesMap<T> = Record<number, Record<number, T>>;

export type CollectionServiceOptions = {
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
  throwOnDuplicates?: string;
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
}

export type CollectionCore<T, UniqueStatus = unknown, Status = unknown> = {
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

  uniqueItems(items: T[]): T[];

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

  setComparator(comparator: ObjectsComparator | ObjectsComparatorFn): void;

  getDuplicates(items: T[]): DuplicatesMap<T> | null;

  setThrowOnDuplicates(message: string | undefined): void;

  setAllowFetchedDuplicates(allowFetchedDuplicates: boolean): void;

  setOnDuplicateErrCallbackParam(onDuplicateErrCallbackParam: any): void;

  /**
   * Returns a function you can use with "trackBy" in `ngFor`
   * @param field - field name
   *
   * Usage example:
   * ```html
   *
   * <div *ngFor="let item of $.items; trackBy: collection.getTrackByFieldFn('uuId')"></div>
   *
   * ```
   */
  getTrackByFieldFn(field: string): (i: number, item: any) => any;

  /**
   * Set multiple options at once. Useful during initialization.
   */
  setOptions(options?: CollectionServiceOptions | null): void;

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
}