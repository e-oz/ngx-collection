import { assertInInjectionContext, computed, inject, Injectable, InjectionToken, Injector, isSignal, Signal, signal } from '@angular/core';
import type { CollectionCore, CollectionOptions, CreateManyParams, CreateParams, DeleteManyParams, DeleteParams, DuplicatesMap, FetchedItems, ReadManyParams, ReadOneParams, ReadParams, RefreshManyParams, RefreshParams, UpdateManyParams, UpdateParams } from './types';
import { CollectionManager } from './collection.manager';
import { catchError, EMPTY, finalize, first, isObservable, map, Observable, of, switchMap } from 'rxjs';
import { tapResponse } from '@ngrx/component-store';
import { isFunction } from 'rxjs/internal/util/isFunction';
import { ObjectsComparator, ObjectsComparatorFn } from './comparator';
import type { SignalBasedCollection } from './signal-based';

export const NGX_COLLECTION_OPTIONS = new InjectionToken<CollectionOptions>('COLLECTION_SERVICE_OPTIONS');

@Injectable()
export class Collection<T, UniqueStatus = unknown, Status = unknown>
  implements SignalBasedCollection<T, UniqueStatus, Status>, CollectionCore<T, UniqueStatus, Status> {

  protected readonly m = new CollectionManager<T, UniqueStatus, Status>();
  private readonly injector = inject(Injector);
  private readonly equalArrays = (a: T[], b: T[]) => a === b || (a.length === 0 && b.length === 0);
  private readonly equalMaps = (a: Map<unknown, unknown>, b: Map<unknown, unknown>) => a === b || (a.size === 0 && b.size === 0);
  private readonly options = inject(NGX_COLLECTION_OPTIONS, {optional: true});
  /**
   * Writeable State Signals
   */
  private readonly _items = signal<T[]>([]);
  private readonly _totalCountFetched = signal<number | undefined>(undefined);
  private readonly _isCreating = signal<boolean>(false);
  private readonly _isReading = signal<boolean>(false);
  private readonly _updatingItems = signal<T[]>([]);
  private readonly _deletingItems = signal<T[]>([]);
  private readonly _refreshingItems = signal<T[]>([]);
  private readonly _status = signal<Map<UniqueStatus, T>>(new Map<UniqueStatus, T>());
  private readonly _statuses = signal<Map<T, Set<Status>>>(new Map<T, Set<Status>>());
  /**
   * State Signals
   */
  public readonly items: Signal<T[]> = computed(() => this._items(), {equal: this.equalArrays});
  public readonly totalCountFetched: Signal<number | undefined> = this._totalCountFetched.asReadonly();
  public readonly isCreating: Signal<boolean> = this._isCreating.asReadonly();
  public readonly isReading: Signal<boolean> = this._isReading.asReadonly();
  /**
   * Derived State Signals
   */
  public readonly updatingItems: Signal<T[]> = computed(() => this._updatingItems(), {equal: this.equalArrays});
  public readonly deletingItems: Signal<T[]> = computed(() => this._deletingItems(), {equal: this.equalArrays});
  public readonly refreshingItems: Signal<T[]> = computed(() => this._refreshingItems(), {equal: this.equalArrays});
  public readonly status: Signal<Map<UniqueStatus, T>> = computed(() => this._status(), {equal: this.equalMaps});
  public readonly statuses: Signal<Map<T, Set<Status>>> = computed(() => this._statuses(), {equal: this.equalMaps});
  public readonly isUpdating: Signal<boolean> = computed(() => this._updatingItems().length > 0);
  public readonly isDeleting: Signal<boolean> = computed(() => this._deletingItems().length > 0);
  public readonly isMutating: Signal<boolean> = computed(() => (this._isCreating() || this.isUpdating() || this.isDeleting()));
  public readonly isSaving: Signal<boolean> = computed(() => (this._isCreating() || this.isUpdating()));
  public readonly isProcessing: Signal<boolean> = computed(() => (this.isMutating() || this._isReading() || this._refreshingItems().length > 0));
  public readonly mutatingItems: Signal<T[]> = computed(() => ([
    ...this._updatingItems(),
    ...this._deletingItems()
  ]), {equal: this.equalArrays});
  public readonly processingItems: Signal<T[]> = computed(() => ([
    ...this.mutatingItems(),
    ...this.refreshingItems()
  ]), {equal: this.equalArrays});

  /***/

  constructor() {
    this.m.setOptions(this.options);
    assertInInjectionContext(this.constructor);
    this.init();
    Promise.resolve().then(() => this.postInit());
  }

  protected init() {

  }

  protected postInit() {

  }

  public create(params: CreateParams<T>): Observable<T> {
    this._isCreating.set(true);
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this._isCreating.set(false)),
      tapResponse((item) => {
          if (item != null) {
            this._items.update((items) => {
              if (!this.m.hasItemIn(item, items)) {
                this.m.callCb(params.onSuccess, item);
                if (this.m.onCreate.observed) {
                  this.m.onCreate.next([item]);
                }
                return [...items, item];
              } else {
                this.m.duplicateNotAdded(item, items);
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                return items;
              }
            });
          }
        },
        (error) => this.m.callCb(params.onError, error)
      )
    );
  }

  public createMany(params: CreateManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this._isCreating.set(true);
    const request = Array.isArray(params.request) ?
      this.m.forkJoinSafe(params.request) :
      this.m.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this._isCreating.set(false)),
      tapResponse((fetched) => {
          if (fetched != null) {
            this._totalCountFetched.set(!Array.isArray(fetched) ? fetched.totalCount : undefined);
            const fetchedItems = Array.isArray(fetched) ? fetched : fetched.items;
            if (fetchedItems.length > 0) {
              this._items.update((items) => {
                const newItems = items.slice();
                const result = this.m.upsertMany(fetchedItems, newItems);
                if (!Array.isArray(result) && result.duplicate) {
                  this.m.duplicateNotAdded(result.duplicate, result.preExisting ? fetchedItems : items);
                  this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                  return items;
                } else {
                  this.m.callCb(params.onSuccess, fetchedItems);
                  if (this.m.onCreate.observed) {
                    this.m.onCreate.next(fetchedItems);
                  }
                  return newItems;
                }
              });
            }
          }
        },
        (error) => this.m.callCb(params.onError, error)
      )
    );
  }

  public read(params: ReadParams<T>): Observable<T[] | FetchedItems<T>> {
    this._isReading.set(true);
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this._isReading.set(false)),
      tapResponse(
        (fetched) => {
          const items = fetched == null ? ([] as T[]) : (Array.isArray(fetched) ? fetched : fetched.items);
          if (items.length > 0) {
            const duplicate = this.m.hasDuplicates(items);
            if (duplicate != null) {
              this.m.duplicateNotAdded(duplicate, items);
              if (!this.m.allowFetchedDuplicates) {
                if (!params.keepExistingOnError) {
                  this._items.set([]);
                  this._totalCountFetched.set(undefined);
                }
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                return;
              }
            }
          }
          this._items.set(items);
          this._totalCountFetched.set(Array.isArray(fetched) ? undefined : fetched.totalCount);

          this.m.callCb(params.onSuccess, items);
          if (this.m.onRead.observed) {
            this.m.onRead.next(items);
          }
        },
        (error) => {
          if (!params.keepExistingOnError) {
            this._items.set([]);
            this._totalCountFetched.set(undefined);
          }
          this.m.callCb(params.onError, error);
        }
      )
    );
  }

  public readOne(params: ReadOneParams<T>): Observable<T> {
    this._isReading.set(true);
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this._isReading.set(false)),
      tapResponse(
        (newItem) => {
          if (newItem != null) {
            this._items.update((items) => {
              const newItems = items.slice();
              if (this.m.upsertOne(newItem, newItems) === 'duplicate') {
                this.m.duplicateNotAdded(newItem, items);
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                return items;
              } else {
                this.m.callCb(params.onSuccess, newItem);
                if (this.m.onRead.observed) {
                  this.m.onRead.next([newItem]);
                }
                return newItems;
              }
            });
          }
        },
        (error) => this.m.callCb(params.onError, error)
      )
    );
  }

  public readMany(params: ReadManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this._isReading.set(true);
    const request = Array.isArray(params.request) ? this.m.forkJoinSafe(params.request) : this.m.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this._isReading.set(false)),
      tapResponse(
        (fetched) => {
          this._totalCountFetched.set(!Array.isArray(fetched) ? fetched.totalCount : undefined);
          const readItems = fetched == null ? ([] as T[]) : (Array.isArray(fetched) ? fetched : fetched.items);
          if (readItems.length > 0) {
            this._items.update((items) => {
              const newItems = items.slice();
              const result = this.m.upsertMany(readItems, newItems);
              if (!Array.isArray(result) && result.duplicate) {
                this.m.duplicateNotAdded(result.duplicate, result.preExisting ? readItems : items);
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                return items;
              } else {
                this.m.callCb(params.onSuccess, newItems);
                if (this.m.onRead.observed) {
                  this.m.onRead.next(readItems);
                }
                return newItems;
              }
            });
          }
        },
        (error) => this.m.callCb(params.onError, error)
      )
    );
  }

  public refresh(params: RefreshParams<T>): Observable<T> {
    this._refreshingItems.update((refreshingItems) => this.m.getWith(refreshingItems, params.item));
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this._refreshingItems.update((refreshingItems) => this.m.getWithout(refreshingItems, params.item))),
      tapResponse(
        (newItem) => {
          if (newItem != null) {
            this._items.update((items) => {
              const newItems = items.slice();
              if (this.m.upsertOne(newItem, newItems) === 'duplicate') {
                this.m.duplicateNotAdded(newItem, items);
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                return items;
              } else {
                this.m.callCb(params.onSuccess, newItem);
                if (this.m.onRead.observed) {
                  this.m.onRead.next([newItem]);
                }
                return newItems;
              }
            });
          }
        },
        (error) => this.m.callCb(params.onError, error)
      )
    );
  }

  public refreshMany(params: RefreshManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this._refreshingItems.update((refreshingItems) => this.m.getWith(refreshingItems, params.items));
    const request = Array.isArray(params.request) ? this.m.forkJoinSafe(params.request) : this.m.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this._refreshingItems.update((refreshingItems) => this.m.getWithout(refreshingItems, params.items))),
      tapResponse(
        (fetched) => {
          if (fetched != null) {
            this._totalCountFetched.set(!Array.isArray(fetched) ? fetched.totalCount : undefined);
            const fetchedItems = Array.isArray(fetched) ? fetched : fetched.items;
            if (fetchedItems.length > 0) {
              this._items.update((items) => {
                const newItems = items.slice();
                const result = this.m.upsertMany(fetchedItems, newItems);
                if (!Array.isArray(result) && result.duplicate) {
                  this.m.duplicateNotAdded(result.duplicate, result.preExisting ? fetchedItems : items);
                  this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                  return items;
                } else {
                  this.m.callCb(params.onSuccess, newItems);
                  if (this.m.onRead.observed) {
                    this.m.onRead.next(fetchedItems);
                  }
                  return newItems;
                }
              });
            }
          }
        },
        (error) => this.m.callCb(params.onError, error)
      )
    );
  }

  public update(params: UpdateParams<T>): Observable<T> {
    this._updatingItems.update((updatingItems) => this.m.getWith(updatingItems, params.item));
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this._updatingItems.update((updatingItems) => this.m.getWithout(updatingItems, params.item))),
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
            this._items.update((items) => {
              const newItems = items.slice();
              if (this.m.upsertOne(newItem, newItems) === 'duplicate') {
                this.m.duplicateNotAdded(newItem, items);
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                return items;
              } else {
                this.m.callCb(params.onSuccess, newItem);
                if (this.m.onUpdate.observed) {
                  this.m.onUpdate.next([newItem]);
                }
                return newItems;
              }
            });
          }
          return of(newItem);
        }
      }),
      catchError((error) => {
        this.m.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public updateMany(params: UpdateManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this._updatingItems.update((updatingItems) => this.m.getWith(updatingItems, params.items));
    const request = Array.isArray(params.request) ? this.m.forkJoinSafe(params.request) : this.m.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this._updatingItems.update((updatingItems) => this.m.getWithout(updatingItems, params.items))),
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
            this._items.update((items) => {
              const newItems = items.slice();
              const result = this.m.upsertMany(updatedItems, newItems);
              if (!Array.isArray(result) && result.duplicate) {
                this.m.duplicateNotAdded(result.duplicate, result.preExisting ? updatedItems : items);
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                return items;
              } else {
                this.m.callCb(params.onSuccess, updatedItems);
                if (this.m.onUpdate.observed) {
                  this.m.onUpdate.next(updatedItems);
                }
                return newItems;
              }
            });
          }
          return of(updatedItems);
        }
      }),
      catchError((error) => {
        this.m.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public delete<R = unknown>(params: DeleteParams<T, R>): Observable<R> {
    this._deletingItems.update((deletingItems) => this.m.getWith(deletingItems, params.item));
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this._deletingItems.update((deletingItems) => this.m.getWithout(deletingItems, params.item))),
      switchMap((response) => {
        if (params.readRequest) {
          return this.read({
            request: params.readRequest,
            onSuccess: params.onSuccess ? () => params.onSuccess?.(response) : undefined,
            onError: params.onError,
          }).pipe(map(_ => response));
        } else {
          this._totalCountFetched.update((prevTotalCount) => this.m.getDecrementedTotalCount(
            [response],
            1,
            prevTotalCount,
            params.decrementTotalCount
          ) ?? prevTotalCount);
          this._items.update((items) => items.filter(item => !this.m.comparator.equal(item, params.item)));
          this.m.callCb(params.onSuccess, response);
          if (this.m.onDelete.observed) {
            this.m.onDelete.next([params.item]);
          }
          return of(response);
        }
      }),
      catchError((error) => {
        this.m.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public deleteMany<R = unknown>(params: DeleteManyParams<T, R>): Observable<R[]> {
    this._deletingItems.update((deletingItems) => this.m.getWith(deletingItems, params.items));
    const requests = Array.isArray(params.request) ?
      this.m.forkJoinSafe(params.request)
      : this.m.forkJoinSafe([params.request]);
    return requests.pipe(
      finalize(() => this._deletingItems.update((deletingItems) => this.m.getWithout(deletingItems, params.items))),
      first(),
      switchMap((response) => {
        if (params.readRequest) {
          return this.read({
            request: params.readRequest,
            onSuccess: params.onSuccess ? () => params.onSuccess?.(response) : undefined,
            onError: params.onError,
          }).pipe(map(_ => response));
        } else {
          this._totalCountFetched.update((prevTotalCount) => this.m.getDecrementedTotalCount(
            response,
            params.items.length,
            prevTotalCount,
            params.decrementTotalCount
          ) ?? prevTotalCount);
          this._items.update((items) => items.filter(item => !this.m.has(item, params.items)));
          this.m.callCb(params.onSuccess, response);
          if (this.m.onDelete.observed) {
            this.m.onDelete.next(params.items);
          }
          return of(response);
        }
      }),
      catchError((error) => {
        this.m.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public hasItemIn(item: Partial<T>, arr: Partial<T>[]): boolean {
    return this.m.hasItemIn(item, arr);
  }

  public uniqueItems(items: T[]): T[] {
    return this.m.uniqueItems(items);
  }

  public setUniqueStatus(status: UniqueStatus, item: T, active: boolean = true) {
    this._status.update((prev) => (this.m.setUniqueStatus(prev, status, item, active)));
  }

  public deleteUniqueStatus(status: UniqueStatus) {
    this._status.update((prev) => (this.m.deleteUniqueStatus(prev, status)));
  }

  public setItemStatus(item: T, status: Status) {
    this._statuses.update((prev) => (this.m.setItemStatus(prev, item, status)));
  }

  public deleteItemStatus(item: T, status: Status) {
    this._statuses.update((prev) => (this.m.deleteItemStatus(prev, item, status)));
  }

  public isItemDeleting(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.m.hasItemIn(i, this._deletingItems());
    });
  }

  public isItemRefreshing(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.m.hasItemIn(i, this._refreshingItems());
    });
  }

  public isItemUpdating(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.m.hasItemIn(i, this._updatingItems());
    });
  }

  public isItemMutating(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.m.hasItemIn(i, this.mutatingItems());
    });
  }

  public isItemProcessing(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.isProcessing() && (this.m.hasItemIn(i, this._refreshingItems()) || this.m.hasItemIn(i, this.mutatingItems()));
    });
  }

  public getItem(filter: Partial<T> | Observable<Partial<T>> | Signal<Partial<T>>): Signal<T | undefined> {
    if (isObservable(filter)) {
      const _filter = this.m.toSignal(filter, this.injector);
      return computed(() => {
        const item = _filter();
        return item ? this.m.getItemByPartial(item, this._items()) : undefined;
      });
    } else {
      if (isFunction(filter) && isSignal(filter)) {
        return computed(() => {
          const item = filter();
          return item ? this.m.getItemByPartial(item, this._items()) : undefined;
        });
      } else {
        return computed(() => this.m.getItemByPartial(filter, this._items()));
      }
    }
  }

  public getItemByField<K extends keyof T>(field: K | K[], fieldValue: T[K] | Observable<T[K]> | Signal<T[K]>): Signal<T | undefined> {
    const fields = Array.isArray(field) ? field : [field];
    if (isObservable(fieldValue)) {
      const fieldValueSignal = this.m.toSignal(fieldValue, this.injector);
      return computed(() => {
        const fv = fieldValueSignal();
        if (fv == null) {
          return undefined;
        }
        return this._items().find((i) => fields.find((f) => i[f] === fv) !== undefined);
      });
    } else {
      if (isFunction(fieldValue) && isSignal(fieldValue)) {
        return computed(() => {
          const fv = fieldValue();
          if (fv == null) {
            return undefined;
          }
          return this._items().find((i) => fields.find((f) => i[f] === fv) !== undefined);
        });
      } else {
        return computed(() => this._items().find((i) =>
          fields.find((f) => i[f] === fieldValue) !== undefined
        ));
      }
    }
  }

  public getItemByPartial(partItem: Partial<T>, items: T[]): T | undefined {
    return this.m.getItemByPartial(partItem, items);
  }

  public setComparator(comparator: ObjectsComparator | ObjectsComparatorFn) {
    this.m.setComparator(comparator);
  }

  public getDuplicates(items: T[]): DuplicatesMap<T> | null {
    return this.m.getDuplicates(items);
  }

  public setThrowOnDuplicates(message: string | undefined) {
    this.m.throwOnDuplicates = message;
  }

  public setAllowFetchedDuplicates(allowFetchedDuplicates: boolean) {
    this.m.allowFetchedDuplicates = allowFetchedDuplicates;
  }

  public setOnDuplicateErrCallbackParam(onDuplicateErrCallbackParam: any) {
    this.m.onDuplicateErrCallbackParam = onDuplicateErrCallbackParam;
  }

  public getTrackByFieldFn(field: string): (i: number, item: any) => any {
    return this.m.getTrackByFieldFn(field);
  }

  public setOptions(options?: CollectionOptions | null) {
    this.m.setOptions(options);
  }

  public listenForCreate(): Observable<T[]> {
    return this.m.onCreate.asObservable();
  }

  public listenForRead(): Observable<T[]> {
    return this.m.onRead.asObservable();
  }

  public listenForUpdate(): Observable<T[]> {
    return this.m.onUpdate.asObservable();
  }

  public listenForDelete(): Observable<Partial<T>[]> {
    return this.m.onDelete.asObservable();
  }

  public listenForItemsUpdate(items: Partial<T>[]): Observable<T[]> {
    return this.m.listenForItemsUpdate(items);
  }

  public listenForItemsDeletion(items: Partial<T>[]): Observable<Partial<T>[]> {
    return this.m.listenForItemsDeletion(items);
  }
}
