import { catchError, EMPTY, finalize, first, isObservable, map, Observable, startWith, switchMap, withLatestFrom } from 'rxjs';
import { computed, inject, Inject, Injectable, Injector, isDevMode, isSignal, Optional, Signal, untracked } from '@angular/core';
import { ComponentStore, tapResponse } from '@ngrx/component-store';
import { ObjectsComparator, ObjectsComparatorFn } from './comparator';
import { toSignal } from '@angular/core/rxjs-interop';
import { isFunction } from 'rxjs/internal/util/isFunction';
import type { CollectionCore, CollectionOptions, CollectionState, CreateManyParams, CreateParams, DeleteManyParams, DeleteParams, DuplicatesMap, FetchedItems, ReadManyParams, ReadOneParams, ReadParams, RefreshManyParams, RefreshParams, UpdateManyParams, UpdateParams } from './types';
import { CollectionManager } from './collection.manager';
import type { ItemViewModel, ObservableBasedCollection, ViewModel } from './observable-based';

@Injectable()
export class CollectionService<T, UniqueStatus = any, Status = any>
  extends ComponentStore<CollectionState<T, UniqueStatus, Status>>
  implements ObservableBasedCollection<T, UniqueStatus, Status>, CollectionCore<T, UniqueStatus, Status> {

  protected readonly m = new CollectionManager<T, UniqueStatus, Status>();

  public readonly items$ = this.select(s => s.items);
  public readonly totalCountFetched$ = this.select(s => s.totalCountFetched);
  public readonly updatingItems$ = this.select(s => s.updatingItems);
  public readonly deletingItems$ = this.select(s => s.deletingItems);
  public readonly refreshingItems$ = this.select(s => s.refreshingItems);
  public readonly mutatingItems$: Observable<T[]> = this.select(
    this.updatingItems$,
    this.deletingItems$,
    (updatingItems, deletingItems) => [...updatingItems, ...deletingItems]
  );
  public readonly processingItems$: Observable<T[]> = this.select(
    this.mutatingItems$,
    this.refreshingItems$,
    (mutatingItems, refreshingItems) => [...mutatingItems, ...refreshingItems]
  );

  public readonly isCreating$ = this.select(s => s.isCreating);
  public readonly isReading$ = this.select(s => s.isReading);
  public readonly isUpdating$: Observable<boolean> = this.select(this.updatingItems$, (items) => items.length > 0);
  public readonly isDeleting$: Observable<boolean> = this.select(this.deletingItems$, (items) => items.length > 0);

  public readonly isSaving$: Observable<boolean> = this.select(
    this.isCreating$,
    this.isUpdating$,
    (isCreating, isUpdating) => isCreating || isUpdating
  );
  public readonly isMutating$: Observable<boolean> = this.select(
    this.isCreating$,
    this.isUpdating$,
    this.isDeleting$,
    (isCreating, isUpdating, isDeleting) => isCreating || isUpdating || isDeleting
  );
  public readonly isProcessing$: Observable<boolean> = this.select(
    this.isMutating$,
    this.isReading$,
    this.refreshingItems$,
    (isMutating, isReading, refreshingItems) => isMutating || isReading || refreshingItems.length > 0
  );
  public readonly statuses$ = this.select(s => s.statuses);
  public readonly status$ = this.select(s => s.status);

  private _itemsSignal?: Signal<T[]>;

  public get itemsSignal(): Signal<T[]> {
    return this._itemsSignal ?? (
      this._itemsSignal = untracked(() => toSignal(
        this.items$,
        {initialValue: [] as T[], injector: this.injector}
      ))
    );
  }

  private _totalCountFetchedSignal?: Signal<number | undefined>;

  public get totalCountFetchedSignal(): Signal<number | undefined> {
    if (this._totalCountFetchedSignal) {
      return this._totalCountFetchedSignal;
    }
    return this._totalCountFetchedSignal = untracked(() => toSignal(
      this.totalCountFetched$,
      {initialValue: undefined, injector: this.injector}
    ));
  }

  private _updatingItemsSignal?: Signal<T[]>;

  public get updatingItemsSignal(): Signal<T[]> {
    return this._updatingItemsSignal ?? (
      this._updatingItemsSignal = untracked(() => toSignal(
        this.updatingItems$,
        {initialValue: [] as T[], injector: this.injector}
      )));
  };

  private _deletingItemsSignal?: Signal<T[]>;

  public get deletingItemsSignal(): Signal<T[]> {
    return this._deletingItemsSignal ?? (
      this._deletingItemsSignal = untracked(() => toSignal(
        this.deletingItems$,
        {initialValue: [] as T[], injector: this.injector}
      )));
  }

  private _refreshingItemsSignal?: Signal<T[]>;

  public get refreshingItemsSignal(): Signal<T[]> {
    return this._refreshingItemsSignal ?? (
      this._refreshingItemsSignal = untracked(() => toSignal(
        this.refreshingItems$,
        {initialValue: [] as T[], injector: this.injector}
      )));
  }

  private _mutatingItemsSignal?: Signal<T[]>;

  public get mutatingItemsSignal(): Signal<T[]> {
    return this._mutatingItemsSignal ?? (
      this._mutatingItemsSignal = untracked(() => toSignal(
        this.mutatingItems$,
        {initialValue: [] as T[], injector: this.injector}
      )));
  }

  private _processingItemsSignal?: Signal<T[]>;

  public get processingItemsSignal(): Signal<T[]> {
    return this._processingItemsSignal ?? (
      this._processingItemsSignal = untracked(() => toSignal(
        this.processingItems$,
        {initialValue: [] as T[], injector: this.injector}
      )));
  }

  private _isCreatingSignal?: Signal<boolean>;

  public get isCreatingSignal(): Signal<boolean> {
    return this._isCreatingSignal ?? (
      this._isCreatingSignal = untracked(() => toSignal(
        this.isCreating$,
        {initialValue: false, injector: this.injector}
      )));
  }

  private _isReadingSignal?: Signal<boolean>;

  public get isReadingSignal(): Signal<boolean> {
    return this._isReadingSignal ?? (
      this._isReadingSignal = untracked(() => toSignal(
        this.isReading$,
        {initialValue: false, injector: this.injector}
      )));
  }

  private _isUpdatingSignal?: Signal<boolean>;

  public get isUpdatingSignal(): Signal<boolean> {
    return this._isUpdatingSignal ?? (
      this._isUpdatingSignal = untracked(() => toSignal(
        this.isUpdating$,
        {initialValue: false, injector: this.injector}
      )));
  }

  private _isDeletingSignal?: Signal<boolean>;

  public get isDeletingSignal(): Signal<boolean> {
    return this._isDeletingSignal ?? (
      this._isDeletingSignal = untracked(() => toSignal(
        this.isDeleting$,
        {initialValue: false, injector: this.injector}
      )));
  }

  private _isSavingSignal?: Signal<boolean>;

  public get isSavingSignal(): Signal<boolean> {
    return this._isSavingSignal ?? (
      this._isSavingSignal = untracked(() => toSignal(
        this.isSaving$,
        {initialValue: false, injector: this.injector}
      )));
  }

  private _isMutatingSignal?: Signal<boolean>;

  public get isMutatingSignal(): Signal<boolean> {
    return this._isMutatingSignal ?? (
      this._isMutatingSignal = untracked(() => toSignal(
        this.isMutating$,
        {initialValue: false, injector: this.injector}
      )));
  }

  private _isProcessingSignal?: Signal<boolean>;

  public get isProcessingSignal(): Signal<boolean> {
    return this._isProcessingSignal ?? (
      this._isProcessingSignal = untracked(() => toSignal(
        this.isProcessing$,
        {initialValue: false, injector: this.injector}
      )));
  }

  private _statusesSignal?: Signal<Map<T, Set<Status>>>;

  public get statusesSignal(): Signal<Map<T, Set<Status>>> {
    return this._statusesSignal ?? (
      this._statusesSignal = untracked(() => toSignal(
        this.statuses$,
        {requireSync: true, injector: this.injector}
      )));
  }

  private _statusSignal?: Signal<Map<UniqueStatus, T>>;

  public get statusSignal(): Signal<Map<UniqueStatus, T>> {
    return this._statusSignal ?? (
      this._statusSignal = untracked(() => toSignal(
        this.status$,
        {requireSync: true, injector: this.injector}
      )));
  }

  private defineInjector(): Injector {
    try {
      return inject(Injector);
    } catch (_) {
      const msg = this.constructor.name
        + (this.constructor.name === 'CollectionService' ? '' : ' (CollectionService)')
        + ' should be injected or created in an injection context!';
      if (isDevMode()) {
        throw new Error(msg);
      } else {
        this.m.reportRuntimeError(msg);
        // This will prevent runtime errors when Injector is not required for the used methods,
        // but will fail anyway when Injector is required.
        return undefined as unknown as Injector;
      }
    }
  }

  protected readonly injector: Injector;

  constructor(
    @Inject('COLLECTION_SERVICE_OPTIONS') @Optional() options?: CollectionOptions,
    // You don't need to provide `injector` here if class is injected or created in an injection context
    injector?: Injector,
  ) {
    super({
      items: [],
      updatingItems: [],
      deletingItems: [],
      refreshingItems: [],
      isReading: false,
      isCreating: false,
      statuses: new Map<T, Set<Status>>(),
      status: new Map<UniqueStatus, T>(),
    });
    this.m.setOptions(options);
    this.injector = injector ?? this.defineInjector();
    this.init();
    Promise.resolve().then(() => this.postInit());
  }

  protected init() {

  }

  protected postInit() {

  }

  public create(params: CreateParams<T>): Observable<T> {
    this.patchState({isCreating: true});
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this.patchState({isCreating: false})),
      withLatestFrom(this.items$),
      tapResponse(([item, items]) => {
          if (item != null) {
            if (!this.m.hasItemIn(item, items)) {
              this.patchState({items: [...items, item]});
              this.m.callCb(params.onSuccess, item);
              if (this.m.onCreate.observed) {
                this.m.onCreate.next([item]);
              }
            } else {
              this.m.duplicateNotAdded(item, items);
              this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
            }
          }
        },
        (error) => this.m.callCb(params.onError, error)
      ),
      map(([r]) => r)
    );
  }

  public createMany(params: CreateManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this.patchState({isCreating: true});
    const request = Array.isArray(params.request) ? this.m.forkJoinSafe(params.request) : this.m.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.patchState({isCreating: false})),
      withLatestFrom(this.items$),
      tapResponse(([fetched, items]) => {
          if (fetched != null) {
            this.patchState({totalCountFetched: Array.isArray(fetched) ? undefined : fetched.totalCount});
            const fetchedItems = Array.isArray(fetched) ? fetched : fetched.items;
            if (fetchedItems.length > 0) {
              const newItems = items.slice();
              const result = this.m.upsertMany(fetchedItems, newItems);
              if (!Array.isArray(result) && result.duplicate) {
                this.m.duplicateNotAdded(result.duplicate, result.preExisting ? fetchedItems : items);
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
              } else {
                this.patchState({items: newItems});
                this.m.callCb(params.onSuccess, fetchedItems);
                if (this.m.onCreate.observed) {
                  this.m.onCreate.next(fetchedItems);
                }
              }
            }
          }
        },
        (error) => this.m.callCb(params.onError, error)
      ),
      map(([r]) => r)
    );
  }

  public read(params: ReadParams<T>): Observable<T[] | FetchedItems<T>> {
    this.patchState({isReading: true});
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this.patchState({isReading: false})),
      tapResponse(
        (fetched) => {
          const items = fetched == null ? ([] as T[]) : (Array.isArray(fetched) ? fetched : fetched.items);
          if (items.length > 0) {
            const duplicate = this.m.hasDuplicates(items);
            if (duplicate != null) {
              this.m.duplicateNotAdded(duplicate, items);
              if (!this.m.allowFetchedDuplicates) {
                if (!params.keepExistingOnError) {
                  this.patchState({items: [], totalCountFetched: undefined});
                }
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                return;
              }
            }
          }
          this.patchState({
            items,
            totalCountFetched: Array.isArray(fetched) ? undefined : fetched.totalCount,
          });
          this.m.callCb(params.onSuccess, items);
          if (this.m.onRead.observed) {
            this.m.onRead.next(items);
          }
        },
        (error) => {
          if (!params.keepExistingOnError) {
            this.patchState({items: [], totalCountFetched: undefined});
          }
          this.m.callCb(params.onError, error);
        }
      )
    );
  }

  public update(params: UpdateParams<T>): Observable<T> {
    this.patchState((s) => ({updatingItems: this.m.getWith(s.updatingItems, params.item)}));
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this.patchState((s) => ({updatingItems: this.m.getWithout(s.updatingItems, params.item)}))),
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
          return this.items$.pipe(
            first(),
            map((items) => {
              if (newItem != null) {
                const newItems = items.slice();
                if (this.m.upsertOne(newItem, newItems) === 'duplicate') {
                  this.m.duplicateNotAdded(newItem, items);
                  this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                } else {
                  this.patchState({items: newItems});
                  this.m.callCb(params.onSuccess, newItem);
                  if (this.m.onUpdate.observed) {
                    this.m.onUpdate.next([newItem]);
                  }
                }
              }
              return newItem;
            })
          );
        }
      }),
      catchError((error) => {
        this.m.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public delete<R = unknown>(params: DeleteParams<T, R>): Observable<R> {
    this.patchState((s) => ({deletingItems: this.m.getWith(s.deletingItems, params.item)}));
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this.patchState((s) => ({deletingItems: this.m.getWithout(s.deletingItems, params.item)}))),
      switchMap((response) => {
        if (params.readRequest) {
          return this.read({
            request: params.readRequest,
            onSuccess: params.onSuccess ? () => params.onSuccess?.(response) : undefined,
            onError: params.onError,
          }).pipe(map(_ => response));
        } else {
          return this.items$.pipe(
            withLatestFrom(this.totalCountFetched$),
            first(),
            map(([items, prevTotalCount]) => {
              const newTotalCount = this.m.getDecrementedTotalCount(
                [response],
                1,
                prevTotalCount,
                params.decrementTotalCount
              );
              const filteredItems = items.filter(item => !this.m.comparator.equal(item, params.item));
              if (newTotalCount == null) {
                this.patchState({
                  items: filteredItems
                });
              } else {
                this.patchState({
                  items: filteredItems,
                  totalCountFetched: newTotalCount,
                });
              }
              this.m.callCb(params.onSuccess, response);
              if (this.m.onDelete.observed) {
                this.m.onDelete.next([params.item]);
              }
              return response;
            })
          );
        }
      }),
      catchError((error) => {
        this.m.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public refresh(params: RefreshParams<T>): Observable<T> {
    this.patchState((s) => ({refreshingItems: this.m.getWith(s.refreshingItems, params.item)}));
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this.patchState((s) => ({refreshingItems: this.m.getWithout(s.refreshingItems, params.item)}))),
      withLatestFrom(this.items$),
      tapResponse(
        ([newItem, items]) => {
          if (newItem != null) {
            const newItems = items.slice();
            if (this.m.upsertOne(newItem, newItems) === 'duplicate') {
              this.m.duplicateNotAdded(newItem, items);
              this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
            } else {
              this.patchState({items: newItems});
              this.m.callCb(params.onSuccess, newItem);
              if (this.m.onRead.observed) {
                this.m.onRead.next([newItem]);
              }
            }
          }
        },
        (error) => this.m.callCb(params.onError, error)
      ),
      map(([r]) => r)
    );
  }

  public refreshMany(params: RefreshManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this.patchState((s) => ({refreshingItems: this.m.getWith(s.refreshingItems, params.items)}));
    const request = Array.isArray(params.request) ? this.m.forkJoinSafe(params.request) : this.m.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.patchState((s) => ({refreshingItems: this.m.getWithout(s.refreshingItems, params.items)}))),
      withLatestFrom(this.items$),
      tapResponse(
        ([fetched, items]) => {
          if (fetched != null) {
            const fetchedItems = Array.isArray(fetched) ? fetched : fetched.items;
            if (fetchedItems.length > 0) {
              const newItems = items.slice();
              const result = this.m.upsertMany(fetchedItems, newItems);
              if (!Array.isArray(result) && result.duplicate) {
                this.m.duplicateNotAdded(result.duplicate, result.preExisting ? fetchedItems : items);
                this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
              } else {
                this.patchState((s) => ({
                  items: newItems,
                  totalCountFetched: Array.isArray(fetched) ? s.totalCountFetched : fetched.totalCount,
                }));
                this.m.callCb(params.onSuccess, newItems);
                if (this.m.onRead.observed) {
                  this.m.onRead.next(fetchedItems);
                }
              }
            } else {
              if (!Array.isArray(fetched) && fetched.totalCount !== undefined) {
                this.patchState({totalCountFetched: fetched.totalCount});
              }
            }
          }
        },
        (error) => this.m.callCb(params.onError, error)
      ),
      map(([r]) => r)
    );
  }

  public readOne(params: ReadOneParams<T>): Observable<T> {
    this.patchState({isReading: true});
    return this.m.toObservableFirstValue(params.request).pipe(
      finalize(() => this.patchState({isReading: false})),
      withLatestFrom(this.items$),
      tapResponse(
        ([newItem, items]) => {
          if (newItem != null) {
            const newItems = items.slice();
            if (this.m.upsertOne(newItem, newItems) === 'duplicate') {
              this.m.duplicateNotAdded(newItem, items);
              this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
            } else {
              this.patchState({items: newItems});
              this.m.callCb(params.onSuccess, newItem);
              if (this.m.onRead.observed) {
                this.m.onRead.next([newItem]);
              }
            }
          }
        },
        (error) => this.m.callCb(params.onError, error)
      ),
      map(([r]) => r)
    );
  }

  public readMany(params: ReadManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this.patchState({isReading: true});
    const request = Array.isArray(params.request) ? this.m.forkJoinSafe(params.request) : this.m.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.patchState({isReading: false})),
      withLatestFrom(this.state$),
      tapResponse(
        ([fetched, {items, totalCountFetched}]) => {
          const readItems = fetched == null ? ([] as T[]) : (Array.isArray(fetched) ? fetched : fetched.items);
          if (readItems.length > 0) {
            const newItems = items.slice();
            const result = this.m.upsertMany(readItems, newItems);
            if (!Array.isArray(result) && result.duplicate) {
              this.m.duplicateNotAdded(result.duplicate, result.preExisting ? readItems : items);
              this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
            } else {
              this.patchState({
                items: newItems,
                totalCountFetched: Array.isArray(fetched) ? totalCountFetched : fetched.totalCount,
              });
              this.m.callCb(params.onSuccess, newItems);
              if (this.m.onRead.observed) {
                this.m.onRead.next(readItems);
              }
            }
          } else {
            if (!Array.isArray(fetched) && fetched.totalCount !== undefined) {
              this.patchState({totalCountFetched: fetched.totalCount});
            }
          }
        },
        (error) => this.m.callCb(params.onError, error)
      ),
      map(([r]) => r)
    );
  }

  public updateMany(params: UpdateManyParams<T>): Observable<T[] | FetchedItems<T>> {
    this.patchState((s) => ({updatingItems: this.m.getWith(s.updatingItems, params.items)}));
    const request = Array.isArray(params.request) ? this.m.forkJoinSafe(params.request) : this.m.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.patchState((s) => ({updatingItems: this.m.getWithout(s.updatingItems, params.items)}))),
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
          return this.items$.pipe(
            first(),
            map((items) => {
              if (updatedItems != null) {
                const newItems = items.slice();
                const result = this.m.upsertMany(updatedItems, newItems);
                if (!Array.isArray(result) && result.duplicate) {
                  this.m.duplicateNotAdded(result.duplicate, result.preExisting ? updatedItems : items);
                  this.m.callCb(params.onError, this.m.onDuplicateErrCallbackParam);
                } else {
                  this.patchState({items: newItems});
                  this.m.callCb(params.onSuccess, updatedItems);
                  if (this.m.onUpdate.observed) {
                    this.m.onUpdate.next(updatedItems);
                  }
                }
              }
              return updatedItems;
            })
          );
        }
      }),
      catchError((error) => {
        this.m.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public deleteMany<R = unknown>(params: DeleteManyParams<T, R>): Observable<R[]> {
    this.patchState((s) => ({deletingItems: this.m.getWith(s.deletingItems, params.items)}));
    const requests = Array.isArray(params.request) ?
      this.m.forkJoinSafe(params.request)
      : this.m.forkJoinSafe([params.request]);
    return requests.pipe(
      finalize(() => this.patchState((s) => ({deletingItems: this.m.getWithout(s.deletingItems, params.items)}))),
      first(),
      switchMap((response) => {
        if (params.readRequest) {
          return this.read({
            request: params.readRequest,
            onSuccess: params.onSuccess ? () => params.onSuccess?.(response) : undefined,
            onError: params.onError,
          }).pipe(map(_ => response));
        } else {
          return this.items$.pipe(
            withLatestFrom(this.totalCountFetched$),
            first(),
            map(([items, prevTotalCount]) => {
              let newTotalCount = this.m.getDecrementedTotalCount(
                response,
                params.items.length,
                prevTotalCount,
                params.decrementTotalCount
              );

              const newItems = items.filter(item => !this.m.has(item, params.items));
              if (newTotalCount == null) {
                this.patchState({
                  items: newItems
                });
              } else {
                this.patchState({
                  items: newItems,
                  totalCountFetched: newTotalCount
                });
              }
              this.m.callCb(params.onSuccess, response);
              if (this.m.onDelete.observed) {
                this.m.onDelete.next(params.items);
              }
              return response;
            }));
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
    this.patchState(s => ({status: this.m.setUniqueStatus(s.status, status, item, active)}));
  }

  public deleteUniqueStatus(status: UniqueStatus) {
    this.patchState((s) => ({status: this.m.deleteUniqueStatus(s.status, status)}));
  }

  public setItemStatus(item: T, status: Status) {
    this.patchState((s) => ({statuses: this.m.setItemStatus(s.statuses, item, status)}));
  }

  public deleteItemStatus(item: T, status: Status) {
    this.patchState((s) => ({statuses: this.m.deleteItemStatus(s.statuses, item, status)}));
  }

  public isItemDeleting(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.m.hasItemIn(i, this.deletingItemsSignal());
    });
  }

  public isItemRefreshing(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.m.hasItemIn(i, this.refreshingItemsSignal());
    });
  }

  public isItemUpdating(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.m.hasItemIn(i, this.updatingItemsSignal());
    });
  }

  public isItemMutating(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.m.hasItemIn(i, this.mutatingItemsSignal());
    });
  }

  public isItemProcessing(itemSource: Partial<T> | Observable<Partial<T> | undefined> | Signal<Partial<T> | undefined>): Signal<boolean> {
    const item = this.m.toSignal(itemSource, this.injector);
    return computed(() => {
      const i = item();
      return !!i && this.isProcessingSignal() && (this.m.hasItemIn(i, this.refreshingItemsSignal()) || this.m.hasItemIn(i, this.mutatingItemsSignal()));
    });
  }

  public getViewModel(): Observable<ViewModel<T, UniqueStatus, Status>> {
    return this.select({
      items: this.items$,
      totalCountFetched: this.select(s => s.totalCountFetched),
      isCreating: this.isCreating$,
      isReading: this.isReading$,
      isUpdating: this.isUpdating$,
      isDeleting: this.isDeleting$,
      isMutating: this.isMutating$,
      isSaving: this.isSaving$,
      isProcessing: this.isProcessing$,
      updatingItems: this.updatingItems$,
      deletingItems: this.deletingItems$,
      mutatingItems: this.mutatingItems$,
      refreshingItems: this.refreshingItems$,
      statuses: this.statuses$,
      status: this.status$,
    });
  }

  private _viewModelSignal?: Signal<ViewModel<T, UniqueStatus, Status>>;

  public getViewModelSignal(): Signal<ViewModel<T, UniqueStatus, Status>> {
    return this._viewModelSignal ?? (
      this._viewModelSignal = untracked(() => toSignal(
        this.getViewModel(),
        {requireSync: true, injector: this.injector}
      )));
  }

  public getItemViewModel(itemSource: Observable<T | undefined> | Signal<T | undefined>): Observable<ItemViewModel> {
    const src = this.m.toObservable(itemSource, this.injector);
    return this.select({
      isDeleting: this.select(
        this.deletingItems$,
        src.pipe(startWith(undefined)),
        (items, item) => !!item && this.m.hasItemIn(item, items)
      ),
      isRefreshing: this.select(
        this.refreshingItems$,
        src.pipe(startWith(undefined)),
        (items, item) => !!item && this.m.hasItemIn(item, items)
      ),
      isUpdating: this.select(
        this.updatingItems$,
        src.pipe(startWith(undefined)),
        (items, item) => !!item && this.m.hasItemIn(item, items)
      ),
      isMutating: this.select(
        this.mutatingItems$,
        src.pipe(startWith(undefined)),
        (items, item) => !!item && this.m.hasItemIn(item, items)
      ),
      isProcessing: this.select(
        this.isProcessing$,
        this.refreshingItems$,
        this.mutatingItems$,
        src.pipe(startWith(undefined)),
        (isProcessing, refreshingItems, mutatingItems, item) => !!item
          && isProcessing
          && (this.m.hasItemIn(item, refreshingItems) || this.m.hasItemIn(item, mutatingItems))
      ),
    });
  }

  public getItemViewModelSignal(itemSource: Observable<T | undefined> | Signal<T | undefined>): Signal<ItemViewModel> {
    return untracked(() => toSignal(
      this.getItemViewModel(itemSource),
      {requireSync: true, injector: this.injector}
    ));
  }

  public getItem(filter: Partial<T> | Observable<Partial<T>> | Signal<Partial<T>>): Observable<T | undefined> {
    if (isObservable(filter)) {
      return this.select(
        filter.pipe(startWith(undefined)),
        this.items$,
        (item, items) => item ? this.m.getItemByPartial(item, items) : undefined
      );
    } else {
      if (isFunction(filter) && isSignal(filter)) {
        return this.select(
          this.m.toObservable(filter, this.injector),
          this.items$,
          (item, items) => item ? this.m.getItemByPartial(item, items) : undefined
        );
      } else {
        return this.select(
          this.items$,
          (items) => this.m.getItemByPartial(filter, items)
        );
      }
    }
  }

  public getItemSignal(filter: Partial<T> | Observable<Partial<T>> | Signal<Partial<T>>): Signal<T | undefined> {
    return untracked(() => toSignal(
      this.getItem(filter),
      {injector: this.injector}
    ));
  }

  public getItemByField<K extends keyof T>(field: K | K[], fieldValue: T[K] | Observable<T[K]> | Signal<T[K]>): Observable<T | undefined> {
    const fields = Array.isArray(field) ? field : [field];
    if (isObservable(fieldValue)) {
      return this.select(
        fieldValue.pipe(startWith(undefined)),
        this.items$,
        (fieldValue, items) => fieldValue != null ?
          items.find((i) =>
            fields.find((f) => i[f] === fieldValue) !== undefined
          )
          : undefined
      );
    } else {
      if (isFunction(fieldValue) && isSignal(fieldValue)) {
        return this.select(
          this.m.toObservable(fieldValue, this.injector),
          this.items$,
          (fieldValue, items) => fieldValue != null ?
            items.find((i) =>
              fields.find((f) => i[f] === fieldValue) !== undefined
            )
            : undefined
        );
      } else {
        return this.select(
          this.items$,
          (items) => items.find((i) =>
            fields.find((f) => i[f] === fieldValue) !== undefined
          )
        );
      }
    }
  }

  public getItemByFieldSignal<K extends keyof T>(field: K | K[], fieldValue: T[K] | Observable<T[K]> | Signal<T[K]>): Signal<T | undefined> {
    return untracked(() => toSignal(
      this.getItemByField(field, fieldValue),
      {injector: this.injector}
    ));
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
