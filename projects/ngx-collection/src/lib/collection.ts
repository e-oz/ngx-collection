import { computed, isDevMode, isSignal, Signal, signal, ValueEqualityFn } from '@angular/core';
import type { CollectionInterface, CollectionOptions, CreateManyParams, CreateParams, DeleteManyParams, DeleteParams, DuplicatesMap, FetchedItems, ReadManyParams, ReadOneParams, ReadParams, RefreshManyParams, RefreshParams, UpdateManyParams, UpdateParams } from './types';
import { catchError, defaultIfEmpty, defer, EMPTY, filter, finalize, first, forkJoin, isObservable, map, merge, Observable, of, Subject, switchMap, tap } from 'rxjs';
import { Comparator, DuplicateError, ObjectsComparator, ObjectsComparatorFn } from './comparator';
import { isEmptyValue } from "./helpers";
import { defaultComparatorFields } from "./internal-types";
import { equalMaps, equalObjects } from "./signal-equality-fn";

export class Collection<T, UniqueStatus = unknown, Status = unknown>
  implements CollectionInterface<T, UniqueStatus, Status> {

  protected comparator: ObjectsComparator = new Comparator();
  protected throwOnDuplicates?: string | false;
  protected allowFetchedDuplicates: boolean = true;
  protected onDuplicateErrCallbackParam = new DuplicateError();
  protected errReporter?: (...args: any[]) => any;

  protected readonly onCreate = new Subject<T[]>();
  protected readonly onRead = new Subject<T[]>();
  protected readonly onUpdate = new Subject<T[]>();
  protected readonly onDelete = new Subject<Partial<T>[]>();

  protected readonly equalItems: ValueEqualityFn<T[]> = (a: T[], b: T[]) => {
    if (!a || !b || a == null || b == null || !Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!this.comparator.equal(a[i], b[i])) {
        return false;
      }
    }
    return true;
  };

  /**
   * Writeable State Signals
   */
  protected readonly state = {
    $items: signal<T[]>([]),
    $totalCountFetched: signal<number | undefined>(undefined),
    $isCreating: signal<boolean>(false),
    $isReading: signal<boolean>(false),
    $isBeforeFirstRead: signal<boolean>(true),
    $updatingItems: signal<T[]>([], { equal: this.equalItems }),
    $deletingItems: signal<T[]>([], { equal: this.equalItems }),
    $refreshingItems: signal<T[]>([], { equal: this.equalItems }),
    $status: signal<Map<UniqueStatus, T>>(new Map<UniqueStatus, T>(), { equal: equalMaps }),
    $statuses: signal<Map<T, Set<Status>>>(new Map<T, Set<Status>>(), { equal: equalMaps }),
  } as const;

  /**
   * State Signals
   */
  public readonly $items = this.state.$items.asReadonly();
  public readonly $totalCountFetched = this.state.$totalCountFetched.asReadonly();
  public readonly $isCreating = this.state.$isCreating.asReadonly();
  public readonly $isReading = this.state.$isReading.asReadonly();
  public readonly $isBeforeFirstRead = this.state.$isBeforeFirstRead.asReadonly();

  /**
   * Derived State Signals
   */
  public readonly $updatingItems = this.state.$updatingItems.asReadonly();
  public readonly $deletingItems = this.state.$deletingItems.asReadonly();
  public readonly $refreshingItems = this.state.$refreshingItems.asReadonly();
  public readonly $status = this.state.$status.asReadonly();
  public readonly $statuses = this.state.$statuses.asReadonly();
  public readonly $isUpdating = computed<boolean>(() => this.state.$updatingItems().length > 0);
  public readonly $isDeleting = computed<boolean>(() => this.state.$deletingItems().length > 0);
  public readonly $isMutating = computed<boolean>(() => {
    const isCreating = this.state.$isCreating();
    const isUpdating = this.$isUpdating();
    const isDeleting = this.$isDeleting();
    return isCreating || isUpdating || isDeleting;
  });
  public readonly $isSaving = computed<boolean>(() => {
    const isCreating = this.state.$isCreating();
    const isUpdating = this.$isUpdating();
    return isCreating || isUpdating;
  });
  public readonly $isProcessing = computed<boolean>(() => {
    const isMutating = this.$isMutating();
    const isReading = this.state.$isReading();
    const isRefreshing = this.state.$refreshingItems().length > 0;
    return isMutating || isReading || isRefreshing;
  });
  public readonly $mutatingItems = computed<T[]>(() => ([
    ...this.state.$updatingItems(),
    ...this.state.$deletingItems()
  ]), { equal: this.equalItems });
  public readonly $processingItems = computed<T[]>(() => ([
    ...this.$mutatingItems(),
    ...this.$refreshingItems()
  ]), { equal: this.equalItems });

  /*** Public API Methods ***/

  constructor(options?: CollectionOptions) {
    this.setOptions(options);
    this.init();

    Promise.resolve().then(() => {
      this.asyncInit();

      if (isDevMode() && this.comparator.hasOwnProperty('renderDefaultComparatorError') && (this.comparator as any).renderDefaultComparatorError === true) {
        this.reportRuntimeError('Default Comparator with default id fields will be used.\n' +
          'Don\'t forget to set option \'comparatorFields\' or \'comparator\' using constructor(), setComparator(), init(), or asyncInit().',
          'Collection:',
          this.constructor.name,
          'Comparator fields:',
          defaultComparatorFields);
      }
    });
  }

  /**
   * Created to be overridden.
   * Guaranteed to be empty - no need to call super.init().
   */
  protected init() {

  }

  /**
   * Created to be overridden.
   * Guaranteed to be empty - no need to call super.asyncInit().
   */
  protected asyncInit() {

  }

  public create(params: CreateParams<T>): Observable<T> {
    this.state.$isCreating.set(true);
    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => this.state.$isCreating.set(false)),
      tap((item) => {
        if (item != null) {
          this.state.$items.update((items) => {
            if (!this.hasItemIn(item, items)) {
              this.callCb(params.onSuccess, item);
              if (this.onCreate.observed) {
                this.onCreate.next([item]);
              }
              return [...items, item];
            } else {
              this.duplicateNotAdded(item, items);
              this.callCb(params.onError, this.onDuplicateErrCallbackParam);
              return items;
            }
          });
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public createMany(params: CreateManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this.state.$isCreating.set(true);
    const request = Array.isArray(params.request) ?
      this.forkJoinSafe(params.request) :
      this.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.state.$isCreating.set(false)),
      tap((fetched) => {
        if (fetched != null) {
          this.state.$totalCountFetched.set(!Array.isArray(fetched) ? fetched.totalCount : undefined);
          const fetchedItems = Array.isArray(fetched) ? fetched : fetched.items;
          if (fetchedItems.length > 0) {
            this.state.$items.update((items) => {
              const nextItems = items.slice();
              const result = this.upsertMany(fetchedItems, nextItems);
              if (!Array.isArray(result) && result.duplicate) {
                this.duplicateNotAdded(result.duplicate, result.preExisting ? fetchedItems : items);
                this.callCb(params.onError, this.onDuplicateErrCallbackParam);
                return items;
              } else {
                this.callCb(params.onSuccess, fetchedItems);
                if (this.onCreate.observed) {
                  this.onCreate.next(fetchedItems);
                }
                return nextItems;
              }
            });
          }
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public read(params: ReadParams<T>): Observable<T[] | FetchedItems<T>> {
    this.state.$isReading.set(true);
    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => {
        this.state.$isReading.set(false);
        this.state.$isBeforeFirstRead.set(false);
      }),
      tap((fetched) => {
        const items = fetched == null ? ([] as T[]) : (Array.isArray(fetched) ? fetched : fetched.items);
        if (items.length > 0) {
          const duplicate = this.hasDuplicates(items);
          if (duplicate != null) {
            this.duplicateNotAdded(duplicate, items);
            if (!this.allowFetchedDuplicates) {
              if (!params.keepExistingOnError) {
                this.state.$items.set([]);
                this.state.$totalCountFetched.set(undefined);
              }
              this.callCb(params.onError, this.onDuplicateErrCallbackParam);
              return;
            }
          }
        }
        this.state.$items.set(items);
        this.state.$totalCountFetched.set(Array.isArray(fetched) ? undefined : fetched.totalCount);

        this.callCb(params.onSuccess, items);
        if (this.onRead.observed) {
          this.onRead.next(items);
        }
      }),
      catchError((error) => {
        if (!params.keepExistingOnError) {
          this.state.$items.set([]);
          this.state.$totalCountFetched.set(undefined);
        }
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public readOne(params: ReadOneParams<T>): Observable<T> {
    this.state.$isReading.set(true);
    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => {
        this.state.$isReading.set(false);
        this.state.$isBeforeFirstRead.set(false);
      }),
      tap((newItem) => {
        if (newItem != null) {
          this.state.$items.update((items) => {
            const nextItems = items.slice();
            if (this.upsertOne(newItem, nextItems) === 'duplicate') {
              this.duplicateNotAdded(newItem, items);
              this.callCb(params.onError, this.onDuplicateErrCallbackParam);
              return items;
            } else {
              this.callCb(params.onSuccess, newItem);
              if (this.onRead.observed) {
                this.onRead.next([newItem]);
              }
              return nextItems;
            }
          });
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public readMany(params: ReadManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this.state.$isReading.set(true);
    const request = Array.isArray(params.request) ? this.forkJoinSafe(params.request) : this.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => {
        this.state.$isReading.set(false);
        this.state.$isBeforeFirstRead.set(false);
      }),
      tap((fetched) => {
        this.state.$totalCountFetched.set(!Array.isArray(fetched) ? fetched.totalCount : undefined);
        const readItems = fetched == null ? ([] as T[]) : (Array.isArray(fetched) ? fetched : fetched.items);
        if (readItems.length > 0) {
          this.state.$items.update((items) => {
            const nextItems = items.slice();
            const result = this.upsertMany(readItems, nextItems);
            if (!Array.isArray(result) && result.duplicate) {
              this.duplicateNotAdded(result.duplicate, result.preExisting ? readItems : items);
              this.callCb(params.onError, this.onDuplicateErrCallbackParam);
              return items;
            } else {
              this.callCb(params.onSuccess, nextItems);
              if (this.onRead.observed) {
                this.onRead.next(readItems);
              }
              return nextItems;
            }
          });
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public refresh(params: RefreshParams<T>): Observable<T> {
    this.state.$refreshingItems.update((refreshingItems) => this.getWith(refreshingItems, params.item));
    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => this.state.$refreshingItems.update((refreshingItems) => this.getWithout(refreshingItems, params.item))),
      tap((newItem) => {
        if (newItem != null) {
          this.state.$items.update((items) => {
            const nextItems = items.slice();
            if (this.upsertOne(newItem, nextItems) === 'duplicate') {
              this.duplicateNotAdded(newItem, items);
              this.callCb(params.onError, this.onDuplicateErrCallbackParam);
              return items;
            } else {
              this.callCb(params.onSuccess, newItem);
              if (this.onRead.observed) {
                this.onRead.next([newItem]);
              }
              return nextItems;
            }
          });
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public refreshMany(params: RefreshManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this.state.$refreshingItems.update((refreshingItems) => this.getWith(refreshingItems, params.items));
    const request = Array.isArray(params.request) ? this.forkJoinSafe(params.request) : this.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.state.$refreshingItems.update((refreshingItems) => this.getWithout(refreshingItems, params.items))),
      tap((fetched) => {
        if (fetched != null) {
          this.state.$totalCountFetched.set(!Array.isArray(fetched) ? fetched.totalCount : undefined);
          const fetchedItems = Array.isArray(fetched) ? fetched : fetched.items;
          if (fetchedItems.length > 0) {
            this.state.$items.update((items) => {
              const nextItems = items.slice();
              const result = this.upsertMany(fetchedItems, nextItems);
              if (!Array.isArray(result) && result.duplicate) {
                this.duplicateNotAdded(result.duplicate, result.preExisting ? fetchedItems : items);
                this.callCb(params.onError, this.onDuplicateErrCallbackParam);
                return items;
              } else {
                this.callCb(params.onSuccess, nextItems);
                if (this.onRead.observed) {
                  this.onRead.next(fetchedItems);
                }
                return nextItems;
              }
            });
          }
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public update(params: UpdateParams<T>): Observable<T> {
    this.state.$updatingItems.update((updatingItems) => this.getWith(updatingItems, params.item));
    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => this.state.$updatingItems.update((updatingItems) => this.getWithout(updatingItems, params.item))),
      first(),
      switchMap((newItem) => {
        if (params.refreshRequest) {
          return this.refresh({
            request: params.refreshRequest,
            item: params.item,
            onSuccess: params.onSuccess,
            onError: params.onError,
          });
        } else {
          if (newItem != null) {
            this.state.$items.update((items) => {
              const nextItems = items.slice();
              if (this.upsertOne(newItem, nextItems) === 'duplicate') {
                this.duplicateNotAdded(newItem, items);
                this.callCb(params.onError, this.onDuplicateErrCallbackParam);
                return items;
              } else {
                this.callCb(params.onSuccess, newItem);
                if (this.onUpdate.observed) {
                  this.onUpdate.next([newItem]);
                }
                return nextItems;
              }
            });
          }
          return of(newItem);
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public updateMany(params: UpdateManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this.state.$updatingItems.update((updatingItems) => this.getWith(updatingItems, params.items));
    const request = Array.isArray(params.request) ? this.forkJoinSafe(params.request) : this.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.state.$updatingItems.update((updatingItems) => this.getWithout(updatingItems, params.items))),
      first(),
      switchMap((updatedItems) => {
        if (params.refreshRequest) {
          return this.refreshMany({
            request: params.refreshRequest,
            items: params.items,
            onSuccess: params.onSuccess,
            onError: params.onError,
          });
        } else {
          if (updatedItems != null) {
            this.state.$items.update((items) => {
              const nextItems = items.slice();
              const result = this.upsertMany(updatedItems, nextItems);
              if (!Array.isArray(result) && result.duplicate) {
                this.duplicateNotAdded(result.duplicate, result.preExisting ? updatedItems : items);
                this.callCb(params.onError, this.onDuplicateErrCallbackParam);
                return items;
              } else {
                this.callCb(params.onSuccess, updatedItems);
                if (this.onUpdate.observed) {
                  this.onUpdate.next(updatedItems);
                }
                return nextItems;
              }
            });
          }
          return of(updatedItems);
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public delete<R = unknown>(params: DeleteParams<T, R>): Observable<R> {
    this.state.$deletingItems.update((deletingItems) => this.getWith(deletingItems, params.item));
    const req = params.request ? this.toObservableFirstValue(params.request) : of(null as R);
    return req.pipe(
      finalize(() => this.state.$deletingItems.update((deletingItems) => this.getWithout(deletingItems, params.item))),
      switchMap((response) => {
        if (params.readRequest) {
          return this.read({
            request: params.readRequest,
            onSuccess: params.onSuccess ? () => params.onSuccess?.(response) : undefined,
            onError: params.onError,
          }).pipe(map(_ => response));
        } else {
          this.state.$totalCountFetched.update((prevTotalCount) => this.getDecrementedTotalCount(
            [response],
            1,
            prevTotalCount,
            params.decrementTotalCount
          ) ?? prevTotalCount);
          this.state.$items.update((items) => items.filter(item => !this.comparator.equal(item, params.item)));
          this.callCb(params.onSuccess, response);
          if (this.onDelete.observed) {
            this.onDelete.next([params.item]);
          }
          return of(response);
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public deleteMany<R = unknown>(params: DeleteManyParams<T, R>): Observable<R[]> {
    this.state.$deletingItems.update((deletingItems) => this.getWith(deletingItems, params.items));
    const requests = Array.isArray(params.request) ?
      this.forkJoinSafe(params.request)
      : this.forkJoinSafe([params.request ?? of(null as R)]);
    return requests.pipe(
      finalize(() => this.state.$deletingItems.update((deletingItems) => this.getWithout(deletingItems, params.items))),
      first(),
      switchMap((response) => {
        if (params.readRequest) {
          return this.read({
            request: params.readRequest,
            onSuccess: params.onSuccess ? () => params.onSuccess?.(response) : undefined,
            onError: params.onError,
          }).pipe(map(_ => response));
        } else {
          this.state.$totalCountFetched.update((prevTotalCount) => this.getDecrementedTotalCount(
            response,
            params.items.length,
            prevTotalCount,
            params.decrementTotalCount
          ) ?? prevTotalCount);
          this.state.$items.update((items) => items.filter(item => !this.hasItemIn(item, params.items)));
          this.callCb(params.onSuccess, response);
          if (this.onDelete.observed) {
            this.onDelete.next(params.items);
          }
          return of(response);
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public setUniqueStatus(status: UniqueStatus, item: T, active: boolean = true) {
    const map = this.state.$status();
    const currentItem = map.get(status);
    if (!active) {
      if (currentItem == null || !this.comparator.equal(item, currentItem)) {
        return;
      } else {
        const newMap = new Map(map);
        newMap.delete(status);
        this.state.$status.set(newMap);
      }
    } else {
      if (currentItem != null && this.comparator.equal(item, currentItem)) {
        return;
      } else {
        const newMap = new Map(map);
        newMap.set(status, item);
        this.state.$status.set(newMap);
      }
    }
  }

  public deleteUniqueStatus(status: UniqueStatus) {
    const map = this.state.$status();
    if (map.has(status)) {
      const newMap = new Map(map);
      newMap.delete(status);
      this.state.$status.set(newMap);
    }
  }

  public setItemStatus(item: T, status: Status) {
    const map = this.state.$statuses();
    if (map.get(item)?.has(status)) {
      return;
    }
    const newMap = new Map(map);
    const itemStatuses = newMap.get(item) ?? new Set<Status>();
    itemStatuses.add(status);
    newMap.set(item, itemStatuses);
    this.state.$statuses.set(newMap);
  }

  public deleteItemStatus(item: T, status: Status) {
    const map = this.state.$statuses();
    const current = map.get(item);
    if (current && !current.has(status)) {
      return;
    }
    const newMap = new Map(map);
    const itemStatuses = newMap.get(item);
    if (itemStatuses) {
      itemStatuses.delete(status);
      newMap.set(item, itemStatuses);
      this.state.$statuses.set(newMap);
    }
  }

  public isItemDeleting(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.hasItemIn(i, this.state.$deletingItems());
    });
  }

  public isItemRefreshing(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.hasItemIn(i, this.state.$refreshingItems());
    });
  }

  public isItemUpdating(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.hasItemIn(i, this.state.$updatingItems());
    });
  }

  public isItemMutating(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.hasItemIn(i, this.$mutatingItems());
    });
  }

  public isItemProcessing(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.$isProcessing() && (this.hasItemIn(i, this.state.$refreshingItems()) || this.hasItemIn(i, this.$mutatingItems()));
    });
  }

  public getItem(
    filter: Partial<T> | undefined | Signal<Partial<T> | undefined>,
    equalFn: ValueEqualityFn<T | undefined> | undefined = equalObjects
  ): Signal<T | undefined> {
    if (isSignal(filter)) {
      return computed(() => {
        const item = filter();
        return item ? this.getItemByPartial(item, this.state.$items()) : undefined;
      }, { equal: equalFn });
    } else {
      return computed(() => filter ? this.getItemByPartial(filter, this.state.$items()) : undefined, {
        equal: equalFn
      });
    }
  }

  public getItemByField<K extends keyof T>(
    field: K | K[],
    fieldValue: T[K] | Signal<T[K]>,
    equalFn: ValueEqualityFn<T | undefined> | undefined = equalObjects
  ): Signal<T | undefined> {
    const fields = Array.isArray(field) ? field : [field];
    if (isSignal(fieldValue)) {
      return computed(() => {
        const fv = fieldValue();
        if (fv == null) {
          return undefined;
        }
        return this.state.$items().find((i) => fields.find((f) => i[f] === fv) !== undefined);
      }, { equal: equalFn });
    } else {
      return computed(() => this.state.$items().find((i) =>
        fields.find((f) => i[f] === fieldValue) !== undefined
      ), { equal: equalFn });
    }
  }

  public setThrowOnDuplicates(message: string | undefined) {
    this.throwOnDuplicates = message;
  }

  public setAllowFetchedDuplicates(allowFetchedDuplicates: boolean) {
    this.allowFetchedDuplicates = allowFetchedDuplicates;
  }

  public setOnDuplicateErrCallbackParam(onDuplicateErrCallbackParam: any) {
    this.onDuplicateErrCallbackParam = onDuplicateErrCallbackParam;
  }

  public hasItemIn(item: Partial<T>, arr: Partial<T>[]): boolean {
    if (!arr || !Array.isArray(arr) || arr.length === 0) {
      return false;
    }
    return ((arr.findIndex(i => this.comparator.equal(i, item))) > -1);
  }

  public getTrackByFieldFn(field: string): (i: number, item: any) => any {
    return (i: number, item: any) => {
      try {
        return (!!item
          && typeof item === 'object'
          && Object.hasOwn(item, field)
          && !isEmptyValue(item[field])
        ) ? item[field] : i;
      } catch (e) {
        this.reportRuntimeError(e);
        return i;
      }
    };
  }

  public listenForItemsUpdate(items: Partial<T>[]): Observable<T[]> {
    return merge(this.onUpdate, this.onRead).pipe(
      map((updated) => this.findInSet(items, updated)),
      filter(found => found.length > 0)
    );
  }

  public listenForItemsDeletion(items: Partial<T>[]): Observable<Partial<T>[]> {
    return this.onDelete.pipe(
      map((updated) => this.findInSet(items, updated)),
      filter(found => found.length > 0)
    );
  }

  public listenForCreate(): Observable<T[]> {
    return this.onCreate.asObservable();
  }

  public listenForRead(): Observable<T[]> {
    return this.onRead.asObservable();
  }

  public listenForUpdate(): Observable<T[]> {
    return this.onUpdate.asObservable();
  }

  public listenForDelete(): Observable<Partial<T>[]> {
    return this.onDelete.asObservable();
  }

  public setComparator(comparator: ObjectsComparator | ObjectsComparatorFn) {
    if (typeof comparator === 'function') {
      this.comparator = { equal: comparator };
    } else {
      this.comparator = comparator;
    }
  }

  public setOptions(options?: CollectionOptions | null) {
    if (options != null) {
      if (options.comparator) {
        this.setComparator(options.comparator);
      } else {
        if (options.comparatorFields != null) {
          this.comparator = new Comparator(options.comparatorFields);
        }
      }
      if (options.throwOnDuplicates != null) {
        this.throwOnDuplicates = options.throwOnDuplicates;
      }
      if (typeof options.allowFetchedDuplicates === 'boolean') {
        this.allowFetchedDuplicates = options.allowFetchedDuplicates;
      }
      if (options.onDuplicateErrCallbackParam != null) {
        this.onDuplicateErrCallbackParam = options.onDuplicateErrCallbackParam;
      }
      if (options.errReporter != null && typeof options.errReporter === 'function') {
        this.errReporter = options.errReporter;
      }
    }
  }

  public uniqueItems(items: T[]): T[] {
    if (!Array.isArray(items)) {
      throw new Error('uniqueItems expects an array');
    }
    return items.filter((item, index) => items.indexOf(item as T) === index
      || items.findIndex(i => this.comparator.equal(i, item)) == index
    );
  }

  public getItemByPartial(partItem: Partial<T>, items?: T[]): T | undefined {
    if (!items) {
      items = this.$items();
    }
    return items.find(i => this.comparator.equal(i, partItem));
  }

  public getDuplicates(items: T[]): DuplicatesMap<T> | null {
    if (!Array.isArray(items) || items.length < 2) {
      return null;
    }
    const duplicates: DuplicatesMap<T> = {};
    let hasDupes = false;
    for (let ii = 0; ii < items.length; ii++) {
      const iDupes: Record<number, T> = {};
      let itemHasDupes = false;
      const i = items[ii];
      for (let ij = ii + 1; ij < items.length; ij++) {
        const j = items[ij];
        if (this.comparator.equal(i, j)) {
          iDupes[ij] = j;
          itemHasDupes = true;
        }
      }
      if (itemHasDupes) {
        hasDupes = true;
        iDupes[ii] = i;
        duplicates[ii] = iDupes;
      }
    }
    return hasDupes ? duplicates : null;
  }

  /*** Internal Methods ***/

  protected getWith(items: T[], item: Partial<T> | Partial<T>[]): T[] {
    const addItems = Array.isArray(item) ?
      item.map(i => this.getItemByPartial(i, items) ?? i as T)
      : [this.getItemByPartial(item, items) ?? item as T];
    return this.uniqueItems([
      ...items,
      ...addItems
    ]);
  }

  protected getWithout(items: T[], item: Partial<T> | Partial<T>[]): T[] {
    if (Array.isArray(item)) {
      return items.filter(i => !this.hasItemIn(i, item));
    } else {
      return items.filter(i => !this.comparator.equal(i, item));
    }
  }

  protected findInSet<Ret extends Partial<T>>(seek: Partial<T>[], items: Ret[]): Ret[] {
    return items.filter(i => this.hasItemIn(i, seek));
  }

  protected upsertOne(item: T, items: T[]): T[] | 'duplicate' {
    let firstIndex: number = -1;
    let duplicateIndex: number = -1;
    for (let i = 0; i < items.length; i++) {
      if (this.comparator.equal(item, items[i])) {
        if (firstIndex < 0) {
          firstIndex = i;
        } else {
          duplicateIndex = i;
          break;
        }
      }
    }
    if (firstIndex < 0) {
      items.push(item);
    } else {
      if (duplicateIndex < 0) {
        items[firstIndex] = item;
      } else {
        return 'duplicate';
      }
    }
    return items;
  }

  protected hasDuplicates(items: T[]): T | null {
    if (!Array.isArray(items) || items.length < 2) {
      return null;
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (this.comparator.equal(items[i], items[j])) {
          return items[j];
        }
      }
    }
    return null;
  }

  protected upsertMany(items: T[], toItems: T[]): T[] | {
    duplicate: T,
    preExisting?: boolean
  } {
    const hasDuplicates = this.hasDuplicates(items);
    if (hasDuplicates) {
      return { duplicate: hasDuplicates };
    }
    for (let i = 0; i < items.length; i++) {
      if (this.upsertOne(items[i], toItems) === 'duplicate') {
        return { duplicate: items[i] };
      }
    }
    return toItems;
  }

  protected duplicateNotAdded(item: T, items: T[]) {
    if (this.throwOnDuplicates) {
      throw new Error(this.throwOnDuplicates);
    }
    if (this.errReporter) {
      this.errReporter('Duplicate can not be added to collection:', item, items);
      const duplicates = this.getDuplicates(items);
      if (duplicates) {
        this.errReporter('Duplicates are found in collection:', duplicates);
      }
    }
  }

  protected callCb(cb: ((_: any) => any) | undefined, param: any) {
    if (cb != null) {
      try {
        cb(param);
      } catch (e) {
        this.reportRuntimeError(e);
      }
    }
  }

  protected callErrReporter(...args: any) {
    if (this.errReporter) {
      try {
        this.errReporter(...args);
      } catch (e) {
        console?.error('errReporter threw an exception', e);
      }
    }
  }

  protected reportRuntimeError(...args: any) {
    if (this.errReporter) {
      this.callErrReporter(...args);
    } else {
      console?.error(...args);
    }
  }

  protected getDecrementedTotalCount<R>(
    response: R[],
    itemsCount: number,
    prevTotalCount?: number,
    decrementTotalCount?: boolean | number | string,
  ): number | null {
    try {
      if (decrementTotalCount != null) {
        if (typeof decrementTotalCount === 'string') {
          if (response
            && Array.isArray(response)
            && response.length === 1
            && typeof response[0] === 'object'
            && response[0] != null
          ) {
            const r = response[0] as Record<string, number>;
            if (
              Object.hasOwn(r, decrementTotalCount)
              && typeof r[decrementTotalCount] === 'number'
              && r[decrementTotalCount] >= 0
              && Math.round(r[decrementTotalCount]) === r[decrementTotalCount]
            ) {
              return r[decrementTotalCount];
            }
          }
        } else {
          if (prevTotalCount) {
            if (typeof decrementTotalCount === 'number') {
              const decr = Math.round(decrementTotalCount);
              if (decr === decrementTotalCount && decr > 0 && prevTotalCount >= decr) {
                return prevTotalCount - decrementTotalCount;
              }
            }
            if (typeof decrementTotalCount === 'boolean') {
              if (prevTotalCount >= itemsCount) {
                return prevTotalCount - itemsCount;
              }
            }
          }
        }
      }
    } catch (e) {
      this.reportRuntimeError(e);
    }
    return null;
  }

  protected toObservableFirstValue<Src>(s: Observable<Src> | Signal<Src>): Observable<Src> {
    return isObservable(s) ? s.pipe(first()) : defer(() => of(s()));
  }

  protected forkJoinSafe<Src>(sources: Observable<Src>[] | Signal<Src>[] | (Observable<Src> | Signal<Src>)[]): Observable<Src[]> {
    const source = sources.map(s => this.toObservableFirstValue(s).pipe(
      map(v => ({ value: v, error: false })),
      defaultIfEmpty({ error: true, value: undefined }),
      catchError((e) => {
        this.callErrReporter(e);
        return of({ error: true, value: undefined });
      })
    ));

    return forkJoin(source).pipe(
      map((values) => {
        return values.filter(v => !v.error).map(v => v.value!);
      })
    );
  }
}
