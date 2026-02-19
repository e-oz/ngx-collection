import { assertInInjectionContext, computed, DestroyRef, inject, type Injector, isDevMode, isSignal, type Signal, signal, untracked, type ValueEqualityFn } from "@angular/core";
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  catchError,
  defaultIfEmpty,
  defer,
  EMPTY,
  filter,
  finalize,
  forkJoin,
  isObservable,
  map,
  merge,
  type Observable,
  of,
  Subject,
  switchMap,
  take,
  tap,
  throwError
} from "rxjs";
import { Comparator, DuplicateError, type ObjectsComparator, type ObjectsComparatorFn } from "./comparator";
import { defaultComparatorFields } from "./internal-types";
import type {
  CollectionInterface,
  CollectionOptions,
  CollectionOptionsTyped,
  CreateManyParams,
  CreateParams,
  DeleteManyParams,
  DeleteParams,
  DuplicatesMap,
  FetchedItems,
  LastError,
  ReadFromParams,
  ReadManyParams,
  ReadOneParams,
  ReadParams,
  RefreshManyParams,
  RefreshParams,
  UpdateManyParams,
  UpdateParams
} from "./types";

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

  protected isFirstItemsRequest = true;
  protected onFirstItemsRequest?: Function;
  protected fetchItemRequestFactory?: (item: T) => Observable<T>;

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
    $createProcesses: signal<Array<symbol>>([]),
    $isReadingFrom: signal<Array<Signal<boolean>>>([]),
    $isBeforeFirstRead: signal<boolean>(true),
    $readProcesses: signal<Array<{ token: symbol; items: Partial<T>[] }>>([]),
    $updateProcesses: signal<Array<{ token: symbol; items: Partial<T>[] }>>([]),
    $deleteProcesses: signal<Array<{ token: symbol; items: Partial<T>[] }>>([]),
    $refreshProcesses: signal<Array<{ token: symbol; items: Partial<T>[] }>>([]),
    $status: signal<Map<UniqueStatus, T>>(new Map<UniqueStatus, T>()),
    $statuses: signal<Map<T, Set<Status>>>(new Map<T, Set<Status>>()),
    $lastReadError: signal<LastError<T> | undefined>(undefined),
    $lastReadOneError: signal<LastError<T> | undefined>(undefined),
    $lastReadManyError: signal<LastError<T> | undefined>(undefined),
    $lastRefreshError: signal<LastError<T> | undefined>(undefined),
  } as const;

  /**
   * State Signals
   */
  public readonly $items = computed(() => {
    if (this.isFirstItemsRequest) {
      this.isFirstItemsRequest = false;
      if (this.onFirstItemsRequest) {
        Promise.resolve().then(() => {
          untracked(() => {
            try {
              this.onFirstItemsRequest?.();
            } catch (e) {
              this.reportRuntimeError(e);
            }
          });
        });
      }
    }
    return this.state.$items();
  });
  public readonly $totalCountFetched = this.state.$totalCountFetched.asReadonly();
  public readonly $isCreating = computed(() => this.state.$createProcesses().length > 0);
  public readonly $isBeforeFirstRead = this.state.$isBeforeFirstRead.asReadonly();

  /**
   * Derived State Signals
   */
  public readonly $isReading = computed(() => {
    const hasReading = this.state.$readProcesses().length > 0;
    if (hasReading) {
      return true;
    }
    const externals = this.state.$isReadingFrom();
    if (externals.length) {
      return externals.some((isReading) => isReading());
    }
    return false;
  });
  public readonly $updatingItems = computed<T[]>(() => {
    const processes = this.state.$updateProcesses();
    if (!processes.length) {
      return [];
    }
    const updating = processes.flatMap((process) => process.items);
    return this.uniqueItems<Partial<T>>(updating) as T[];
  });
  public readonly $deletingItems = computed<T[]>(() => {
    const processes = this.state.$deleteProcesses();
    if (!processes.length) {
      return [];
    }
    const deleting = processes.flatMap((process) => process.items);
    return this.uniqueItems<Partial<T>>(deleting) as T[];
  });
  public readonly $refreshingItems = computed<T[]>(() => {
    const processes = this.state.$refreshProcesses();
    if (!processes.length) {
      return [];
    }
    const refreshing = processes.flatMap((process) => process.items);
    return this.uniqueItems<Partial<T>>(refreshing) as T[];
  });
  public readonly $readingItems = computed<Partial<T>[]>(() => {
    const processes = this.state.$readProcesses();
    if (!processes.length) {
      return [];
    }
    const reading = processes.flatMap((process) => process.items);
    return this.uniqueItems<Partial<T>>(reading);
  });
  public readonly $status = this.state.$status.asReadonly();
  public readonly $statuses = this.state.$statuses.asReadonly();
  public readonly $isUpdating = computed<boolean>(() => this.$updatingItems().length > 0);
  public readonly $isDeleting = computed<boolean>(() => this.$deletingItems().length > 0);
  public readonly $isMutating = computed<boolean>(() => {
    const isCreating = this.$isCreating();
    const isUpdating = this.$isUpdating();
    const isDeleting = this.$isDeleting();
    return isCreating || isUpdating || isDeleting;
  });
  public readonly $isSaving = computed<boolean>(() => {
    const isCreating = this.$isCreating();
    const isUpdating = this.$isUpdating();
    return isCreating || isUpdating;
  });
  public readonly $isProcessing = computed<boolean>(() => {
    const isMutating = this.$isMutating();
    const isReading = this.$isReading();
    const isRefreshing = this.$refreshingItems().length > 0;
    return isMutating || isReading || isRefreshing;
  });
  public readonly $mutatingItems = computed<T[]>(() => this.uniqueItems([
    ...this.$updatingItems(),
    ...this.$deletingItems()
  ]));
  public readonly $processingItems = computed<T[]>(() => this.uniqueItems([
    ...this.$mutatingItems(),
    ...this.$refreshingItems()
  ]));
  public readonly $lastReadError = this.state.$lastReadError.asReadonly();
  public readonly $lastReadOneError = this.state.$lastReadOneError.asReadonly();
  public readonly $lastReadManyError = this.state.$lastReadManyError.asReadonly();
  public readonly $lastRefreshError = this.state.$lastRefreshError.asReadonly();

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

  /*** Public API Methods ***/

  constructor(options?: CollectionOptions & CollectionOptionsTyped<T>) {
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
   * Add a new item to the collection.
   * Equals to an "INSERT" request.
   */
  public create(params: CreateParams<T>): Observable<T> {
    const createProcessSymbol = Symbol('createProcess');
    this.state.$createProcesses.update((processes) => [...processes, createProcessSymbol]);

    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => this.state.$createProcesses.update((processes) => processes.filter(process => process !== createProcessSymbol))),
      tap((item) => {
        if (item != null) {
          let onSuccess: undefined | Function = undefined;
          let onError: undefined | Function = undefined;

          this.state.$items.update((items) => {
            if (!this.hasItemIn(item, items)) {
              onSuccess = () => {
                this.callCb(params.onSuccess, item);
                if (this.onCreate.observed) {
                  this.onCreate.next([item]);
                }
              };
              return [...items, item];
            } else {
              this.duplicateNotAdded(item, items);
              onError = () => this.callCb(params.onError, this.onDuplicateErrCallbackParam);
              return items;
            }
          });

          // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
          onSuccess?.();
          // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
          onError?.();
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public createMany(params: CreateManyParams<T>): Observable<T[] | FetchedItems<T>> {
    const createSymbol = Symbol('createManyProcess');
    this.state.$createProcesses.update((processes) => [...processes, createSymbol]);

    const errors: unknown[] = [];
    const request = Array.isArray(params.request) ?
      this.forkJoinSafe(params.request, errors) :
      this.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.state.$createProcesses.update((processes) => processes.filter(process => process !== createSymbol))),
      tap((fetched) => {
        if (params.onError && errors.length) {
          this.callCb(params.onError, errors);
        }
        if (fetched != null) {
          this.state.$totalCountFetched.set(!Array.isArray(fetched) ? fetched.totalCount : undefined);
          const fetchedItems = Array.isArray(fetched) ? fetched : fetched.items;
          if (fetchedItems.length > 0) {
            let onSuccess: undefined | Function = undefined;
            let onError: undefined | Function = undefined;

            this.state.$items.update((items) => {
              const nextItems = items.slice();
              const result = this.upsertMany(fetchedItems, nextItems);
              if (!Array.isArray(result) && result.duplicate) {
                onError = () => {
                  this.duplicateNotAdded(result.duplicate, result.preExisting ? fetchedItems : items);
                  this.callCb(params.onError, this.onDuplicateErrCallbackParam);
                };
                return items;
              } else {
                onSuccess = () => {
                  this.callCb(params.onSuccess, fetchedItems);
                  if (this.onCreate.observed) {
                    this.onCreate.next(fetchedItems);
                  }
                };
                return nextItems;
              }
            });

            // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
            onSuccess?.();
            // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
            onError?.();
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
    const readToken = Symbol('readProcess');
    this.state.$lastReadError.set(undefined);

    const paramItems = params.items;
    this.state.$readProcesses.update((processes) => [
      ...processes,
      { token: readToken, items: paramItems ? paramItems.slice() : [] }
    ]);

    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => {
        this.state.$readProcesses.update((processes) => processes.filter(process => process.token !== readToken));
        this.state.$isBeforeFirstRead.set(false);
      }),
      tap((fetched) => {
        const items = fetched == null ? ([] as T[]) : (Array.isArray(fetched) ? fetched : fetched.items).slice();
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
        this.state.$lastReadError.set({
          errors: [error],
          time: new Date(),
          items: params.items,
          context: params.context,
        });
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
    const readToken = Symbol('readOneProcess');
    this.state.$lastReadOneError.set(undefined);

    const paramItem = params.item;
    this.state.$readProcesses.update((processes) => [
      ...processes,
      { token: readToken, items: paramItem ? [paramItem] : [] }
    ]);

    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => {
        this.state.$readProcesses.update((processes) => processes.filter(process => process.token !== readToken));
        this.state.$isBeforeFirstRead.set(false);
      }),
      tap((newItem) => {
        if (newItem != null) {
          let onSuccess: undefined | Function = undefined;
          let onError: undefined | Function = undefined;

          this.state.$items.update((items) => {
            const nextItems = items.slice();
            if (this.upsertOne(newItem, nextItems) === 'duplicate') {
              onError = () => {
                this.duplicateNotAdded(newItem, items);
                this.callCb(params.onError, this.onDuplicateErrCallbackParam);
              };
              return items;
            } else {
              onSuccess = () => {
                this.callCb(params.onSuccess, newItem);
                if (this.onRead.observed) {
                  this.onRead.next([newItem]);
                }
              };
              return nextItems;
            }
          });

          // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
          onSuccess?.();
          // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
          onError?.();
        }
      }),
      catchError((error) => {
        this.state.$lastReadOneError.set({
          errors: [error],
          time: new Date(),
          items: params.item ? [params.item] : undefined,
          context: params.context,
        });
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public readMany(params: ReadManyParams<T>): Observable<T[] | FetchedItems<T>> {
    const readToken = Symbol('readManyProcess');
    this.state.$lastReadManyError.set(undefined);

    const paramItems = params.items;
    this.state.$readProcesses.update((processes) => [
      ...processes,
      { token: readToken, items: paramItems ? paramItems.slice() : [] }
    ]);
    const errors: unknown[] = [];
    const request = Array.isArray(params.request) ? this.forkJoinSafe(params.request, errors) : this.toObservableFirstValue(params.request);

    return request.pipe(
      finalize(() => {
        this.state.$readProcesses.update((processes) => processes.filter(process => process.token !== readToken));
        this.state.$isBeforeFirstRead.set(false);
      }),
      tap((fetched) => {
        if (params.onError && errors.length) {
          this.callCb(params.onError, errors);
          this.state.$lastReadManyError.set({
            errors,
            time: new Date(),
            items: params.items,
            context: params.context,
          });
        }
        this.state.$totalCountFetched.set(!Array.isArray(fetched) ? fetched.totalCount : undefined);
        const readItems = fetched == null ? ([] as T[]) : (Array.isArray(fetched) ? fetched : fetched.items);
        if (readItems.length > 0) {
          let onSuccess: undefined | Function = undefined;
          let onError: undefined | Function = undefined;

          this.state.$items.update((items) => {
            const nextItems = items.slice();
            const result = this.upsertMany(readItems, nextItems);
            if (!Array.isArray(result) && result.duplicate) {
              onError = () => {
                this.duplicateNotAdded(result.duplicate, result.preExisting ? readItems : items);
                this.callCb(params.onError, this.onDuplicateErrCallbackParam);
              };
              return items;
            } else {
              onSuccess = () => {
                this.callCb(params.onSuccess, nextItems);
                if (this.onRead.observed) {
                  this.onRead.next(readItems);
                }
              };
              return nextItems;
            }
          });

          // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
          onSuccess?.();
          // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
          onError?.();
        }
      }),
      catchError((error) => {
        this.state.$lastReadManyError.set({
          errors: [error],
          time: new Date(),
          items: params.items,
          context: params.context,
        });
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public readFrom(params: ReadFromParams<T>): Observable<FetchedItems<T> | T[]> {
    const s = params.source;
    const p = isObservable(s) ? s : toObservable(s);
    if (params.isReading) {
      const external = params.isReading;
      this.state.$isReadingFrom.update((externals) => [...externals, external]);
    }

    return p.pipe(
      switchMap((fetched) => this.read({
        ...params,
        request: of(fetched),
      })),
      catchError((error) => {
        if (params.onError) {
          this.callCb(params.onError, error);
        }
        return EMPTY;
      })
    );
  }

  public readManyFrom(params: ReadFromParams<T>): Observable<FetchedItems<T> | T[]> {
    const s = params.source;
    const p = isObservable(s) ? s : toObservable(s);
    if (params.isReading) {
      const external = params.isReading;
      this.state.$isReadingFrom.update((externals) => [...externals, external]);
    }

    return p.pipe(
      switchMap((fetched) => this.readMany({
        ...params,
        request: of(fetched),
      })),
      catchError((error) => {
        if (params.onError) {
          this.callCb(params.onError, error);
        }
        return EMPTY;
      })
    );
  }

  public refresh(params: RefreshParams<T>): Observable<T> {
    const refreshToken = Symbol('refreshProcess');
    this.state.$refreshProcesses.update((processes) => [
      ...processes,
      { token: refreshToken, items: [params.item] }
    ]);
    this.state.$lastRefreshError.set(undefined);

    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => this.state.$refreshProcesses.update((processes) => processes.filter(process => process.token !== refreshToken))),
      tap((newItem) => {
        if (newItem != null) {
          let onSuccess: undefined | Function = undefined;
          let onError: undefined | Function = undefined;

          this.state.$items.update((items) => {
            const nextItems = items.slice();
            if (this.upsertOne(newItem, nextItems) === 'duplicate') {
              onError = () => {
                this.duplicateNotAdded(newItem, items);
                this.callCb(params.onError, this.onDuplicateErrCallbackParam);
              }
              return items;
            } else {
              onSuccess = () => {
                this.callCb(params.onSuccess, newItem);
                if (this.onRead.observed) {
                  this.onRead.next([newItem]);
                }
              };
              return nextItems;
            }
          });

          // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
          onSuccess?.();
          // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
          onError?.();
        }
      }),
      catchError((error) => {
        this.state.$lastRefreshError.set({
          errors: [error],
          time: new Date(),
          items: [params.item],
          context: params.context,
        });
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public refreshMany(params: RefreshManyParams<T>): Observable<T[] | FetchedItems<T>> {
    if (!Array.isArray(params.items) || params.items.length === 0) {
      const error = new Error('refreshMany: items array is empty');
      this.reportRuntimeError(error);
      this.callCb(params.onError, error);
      return EMPTY;
    }

    const refreshToken = Symbol('refreshManyProcess');
    this.state.$refreshProcesses.update((processes) => [
      ...processes,
      { token: refreshToken, items: params.items.slice() }
    ]);
    this.state.$lastRefreshError.set(undefined);

    const errors: unknown[] = [];
    const request = Array.isArray(params.request) ? this.forkJoinSafe(params.request, errors) : this.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.state.$refreshProcesses.update((processes) => processes.filter(process => process.token !== refreshToken))),
      tap((fetched) => {
        if (params.onError && errors.length) {
          this.callCb(params.onError, errors);
        }
        if (fetched != null) {
          this.state.$totalCountFetched.set(!Array.isArray(fetched) ? fetched.totalCount : undefined);
          const fetchedItems = Array.isArray(fetched) ? fetched : fetched.items;
          if (fetchedItems.length > 0) {
            let onSuccess: undefined | Function = undefined;
            let onError: undefined | Function = undefined;

            this.state.$items.update((items) => {
              const nextItems = items.slice();
              const result = this.upsertMany(fetchedItems, nextItems);
              if (!Array.isArray(result) && result.duplicate) {
                onError = () => {
                  this.duplicateNotAdded(result.duplicate, result.preExisting ? fetchedItems : items);
                  this.callCb(params.onError, this.onDuplicateErrCallbackParam);
                };
                return items;
              } else {
                onSuccess = () => {
                  this.callCb(params.onSuccess, nextItems);
                  if (this.onRead.observed) {
                    this.onRead.next(fetchedItems);
                  }
                };
                return nextItems;
              }
            });

            // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
            onSuccess?.();
            // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
            onError?.();
          }
        }
      }),
      catchError((error) => {
        this.state.$lastRefreshError.set({
          errors: [error],
          time: new Date(),
          items: params.items,
          context: params.context,
        });
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public update(params: UpdateParams<T>): Observable<T> {
    const updateToken = Symbol('updateProcess');
    this.state.$updateProcesses.update((processes) => [
      ...processes,
      { token: updateToken, items: [params.item] }
    ]);
    return this.toObservableFirstValue(params.request).pipe(
      finalize(() => this.state.$updateProcesses.update((processes) => processes.filter(process => process.token !== updateToken))),
      take(1),
      switchMap((newItem) => {
        if (params.refresh) {
          return this.refresh(params.refresh);
        }
        if (params.refreshRequest) {
          return this.refresh({
            request: params.refreshRequest,
            item: params.item,
            onSuccess: params.onSuccess,
            onError: params.onError,
          });
        } else {
          if (params.refresh) {
            return this.refresh(params.refresh);
          } else {
            if (newItem != null) {
              let onSuccess: undefined | Function = undefined;
              let onError: undefined | Function = undefined;

              this.state.$items.update((items) => {
                const nextItems = items.slice();
                if (this.upsertOne(newItem, nextItems) === 'duplicate') {
                  onError = () => {
                    this.duplicateNotAdded(newItem, items);
                    this.callCb(params.onError, this.onDuplicateErrCallbackParam);
                  };
                  return items;
                } else {
                  onSuccess = () => {
                    this.callCb(params.onSuccess, newItem);
                    if (this.onUpdate.observed) {
                      this.onUpdate.next([newItem]);
                    }
                  };
                  return nextItems;
                }
              });

              // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
              onSuccess?.();
              // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
              onError?.();
            }
            return of(newItem);
          }
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public updateMany(params: UpdateManyParams<T>): Observable<T[] | FetchedItems<T>> {
    if (!Array.isArray(params.items) || params.items.length === 0) {
      const error = new Error('updateMany: items array is empty');
      this.reportRuntimeError(error);
      this.callCb(params.onError, error);
      return EMPTY;
    }

    const updateToken = Symbol('updateManyProcess');
    this.state.$updateProcesses.update((processes) => [
      ...processes,
      { token: updateToken, items: params.items.slice() }
    ]);
    const errors: unknown[] = [];
    const request = Array.isArray(params.request) ? this.forkJoinSafe(params.request, errors) : this.toObservableFirstValue(params.request);
    return request.pipe(
      finalize(() => this.state.$updateProcesses.update((processes) => processes.filter(process => process.token !== updateToken))),
      take(1),
      switchMap((updatedItems) => {
        if (params.onError && errors.length) {
          this.callCb(params.onError, errors);
        }
        if (params.refreshRequest) {
          return this.refreshMany({
            request: params.refreshRequest,
            items: params.items,
            onSuccess: params.onSuccess,
            onError: params.onError,
          });
        } else {
          if (params.refresh) {
            return this.refreshMany(params.refresh);
          } else {
            if (updatedItems != null) {
              let onSuccess: undefined | Function = undefined;
              let onError: undefined | Function = undefined;

              this.state.$items.update((items) => {
                const nextItems = items.slice();
                const result = this.upsertMany(updatedItems, nextItems);
                if (!Array.isArray(result) && result.duplicate) {
                  onError = () => {
                    this.duplicateNotAdded(result.duplicate, result.preExisting ? updatedItems : items);
                    this.callCb(params.onError, this.onDuplicateErrCallbackParam);
                  };
                  return items;
                } else {
                  onSuccess = () => {
                    this.callCb(params.onSuccess, updatedItems);
                    if (this.onUpdate.observed) {
                      this.onUpdate.next(updatedItems);
                    }
                  };
                  return nextItems;
                }
              });

              // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
              onSuccess?.();
              // @ts-ignore old and dumb TS version TODO: Remove this line with TS 5.6+
              onError?.();
            }
            return of(updatedItems);
          }
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public delete<R = unknown>(params: DeleteParams<T, R>): Observable<R> {
    const deleteToken = Symbol('deleteProcess');
    this.state.$deleteProcesses.update((processes) => [
      ...processes,
      { token: deleteToken, items: [params.item] }
    ]);
    const req = params.request ? this.toObservableFirstValue(params.request) : of(null as R);
    return req.pipe(
      finalize(() => this.state.$deleteProcesses.update((processes) => processes.filter(process => process.token !== deleteToken))),
      switchMap((response) => {
        if (params.readRequest) {
          return this.read({
            request: params.readRequest,
            onSuccess: params.onSuccess ? () => params.onSuccess?.(response) : undefined,
            onError: params.onError,
          }).pipe(map(_ => response));
        } else {
          if (params.read) {
            return this.read(params.read).pipe(
              map(_ => response)
            );
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
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public deleteMany<R = unknown>(params: DeleteManyParams<T, R>): Observable<R[]> {
    if (!Array.isArray(params.items) || params.items.length === 0) {
      const error = new Error('deleteMany: items array is empty');
      this.reportRuntimeError(error);
      this.callCb(params.onError, error);
      return EMPTY;
    }

    const deleteToken = Symbol('deleteManyProcess');
    this.state.$deleteProcesses.update((processes) => [
      ...processes,
      { token: deleteToken, items: params.items.slice() }
    ]);
    const errors: unknown[] = [];
    const requests = Array.isArray(params.request) ?
      this.forkJoinSafe(params.request, errors)
      : this.forkJoinSafe([params.request ?? of(null as R)], errors);
    return requests.pipe(
      finalize(() => this.state.$deleteProcesses.update((processes) => processes.filter(process => process.token !== deleteToken))),
      take(1),
      switchMap((response) => {
        if (params.onError && errors.length) {
          this.callCb(params.onError, errors);
        }
        if (params.readRequest) {
          return this.read({
            request: params.readRequest,
            onSuccess: params.onSuccess ? () => params.onSuccess?.(response) : undefined,
            onError: params.onError,
          }).pipe(map(_ => response));
        } else {
          if (params.read) {
            return this.read(params.read).pipe(
              map(_ => response)
            );
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
        }
      }),
      catchError((error) => {
        this.callCb(params.onError, error);
        return EMPTY;
      })
    );
  }

  public fetchItem(itemPartial: Partial<T>, request?: Observable<T>): Observable<T> {
    const item = this.getItemByPartial(itemPartial);
    if (item) {
      return of(item);
    }
    const req = request || (this.fetchItemRequestFactory ? this.fetchItemRequestFactory(itemPartial as T) : undefined);
    if (!req) {
      this.reportRuntimeError('Fetching request is not provided to fetchItem');
      return throwError(() => 404);
    }
    return this.create({
      request: req,
    });
  }

  public setUniqueStatus(status: UniqueStatus, item: T, active: boolean = true) {
    const map = untracked(this.state.$status);
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
    const map = untracked(this.state.$status);
    if (map.has(status)) {
      const newMap = new Map(map);
      newMap.delete(status);
      this.state.$status.set(newMap);
    }
  }

  public setItemStatus(item: T, status: Status) {
    const map = untracked(this.state.$statuses);
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
    const map = untracked(this.state.$statuses);
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
      return !!i && this.hasItemIn(i, this.$deletingItems());
    });
  }

  public isItemRefreshing(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.hasItemIn(i, this.$refreshingItems());
    });
  }

  public isItemUpdating(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.hasItemIn(i, this.$updatingItems());
    });
  }

  public isItemMutating(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.hasItemIn(i, this.$mutatingItems());
    });
  }

  public isItemReading(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.hasItemIn(i, this.$readingItems());
    });
  }

  public isItemProcessing(itemSource: Partial<T> | Signal<Partial<T> | undefined>): Signal<boolean> {
    return computed(() => {
      const i = isSignal(itemSource) ? itemSource() : itemSource;
      return !!i && this.$isProcessing() && (this.hasItemIn(i, [
        ...this.$processingItems(),
        ...this.$readingItems(),
      ]));
    });
  }

  public getItem(
    filter: Partial<T> | undefined | Signal<Partial<T> | undefined>,
    equalFn?: ValueEqualityFn<T | undefined> | undefined
  ): Signal<T | undefined> {
    if (isSignal(filter)) {
      return computed(() => {
        const item = filter();
        return item ? this.getItemByPartial(item, this.$items()) : undefined;
      }, { equal: equalFn });
    } else {
      return computed(() => filter ? this.getItemByPartial(filter, this.$items()) : undefined, {
        equal: equalFn
      });
    }
  }

  public getItemByField<K extends keyof T>(
    field: K | K[],
    fieldValue: T[K] | Signal<T[K] | undefined>,
    equalFn?: ValueEqualityFn<T | undefined> | undefined
  ): Signal<T | undefined> {
    const fields = Array.isArray(field) ? field : [field];
    if (isSignal(fieldValue)) {
      return computed(() => {
        const fv = fieldValue();
        if (fv == null) {
          return undefined;
        }
        return this.$items().find((i) => fields.find((f) => i[f] === fv) !== undefined);
      }, { equal: equalFn });
    } else {
      return computed(() => this.$items().find((i) =>
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

  public setOptions(options?: CollectionOptions & CollectionOptionsTyped<T> | null) {
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
      if (options.onFirstItemsRequest) {
        this.onFirstItemsRequest = options.onFirstItemsRequest;
      }
      if (options.readFrom) {
        this.subscribeTo(this.readFrom(options.readFrom), options.injector);
      }
      if (options.readManyFrom) {
        this.subscribeTo(this.readManyFrom(options.readManyFrom), options.injector);
      }
      if (options.fetchItemRequestFactory) {
        this.fetchItemRequestFactory = options.fetchItemRequestFactory;
      }
    }
  }

  public uniqueItems<N = T | Partial<T>>(items: N[]): N[] {
    if (!Array.isArray(items)) {
      return [];
    }
    return items.filter((item, index) => items.indexOf(item) === index
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

  public setOnFirstItemsRequest(cb: Function | undefined) {
    this.onFirstItemsRequest = cb;
  }

  public idsToPartialItems(ids: unknown[], field: string): Partial<T>[] {
    return ids.map(id => ({ [field]: id } as Partial<T>));
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

  protected getWithPartial(items: Partial<T>[], item: Partial<T> | Partial<T>[]): Partial<T>[] {
    const addItems = Array.isArray(item) ? item : [item];
    return this.uniqueItems([
      ...items,
      ...addItems
    ]);
  }

  protected getWithoutPartial(items: Partial<T>[], item: Partial<T> | Partial<T>[]): Partial<T>[] {
    if (Array.isArray(item)) {
      return items.filter(i => !this.hasItemIn(i, item));
    } else {
      return items.filter(i => !this.comparator.equal(i, item));
    }
  }

  protected findInSet<Ret extends Partial<T>>(seek: Partial<T>[], items: Ret[]): Ret[] {
    return items.filter(i => this.hasItemIn(i, seek));
  }

  /**
   * Mutates `items`!
   */
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

  /**
   * Mutates `toItems`!
   */
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
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('errReporter threw an exception', e);
        }
      }
    }
  }

  protected reportRuntimeError(...args: any) {
    if (this.errReporter) {
      this.callErrReporter(...args);
    } else {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(...args);
      }
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
    return isObservable(s) ? s.pipe(take(1)) : defer(() => of(untracked(s)));
  }

  protected forkJoinSafe<Src>(
    sources: Observable<Src>[] | Signal<Src>[] | (Observable<Src> | Signal<Src>)[],
    errors: unknown[]
  ): Observable<Src[]> {
    const source = sources.map(s => this.toObservableFirstValue(s).pipe(
      map(v => ({ value: v, error: false })),
      defaultIfEmpty({ error: true, value: undefined }),
      catchError((e) => {
        errors.push(e);
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

  protected subscribeTo(source: Observable<unknown>, injector?: Injector) {
    if (!injector && isDevMode()) {
      assertInInjectionContext(this.setOptions);
    }
    const destroyRef = injector ? injector.get(DestroyRef) : inject(DestroyRef);
    source.pipe(
      takeUntilDestroyed(destroyRef)
    ).subscribe();
  }
}
