import { Observable, finalize, map, first, catchError, EMPTY, switchMap, startWith } from 'rxjs';
import { Injectable } from '@angular/core';
import { ComponentStore, tapResponse } from '@ngrx/component-store';
import { concatLatestFrom } from '@ngrx/effects';
import { FetchedItems } from './interfaces';
import { Comparator, ObjectsComparator } from './comparator';

export interface CollectionState<T, UniqueStatus = any, Statuses = any> {
  readonly items: T[];
  readonly totalCountFetched?: number;
  readonly isCreating: boolean;
  readonly isReading: boolean;
  readonly updatingItems: T[];
  readonly deletingItems: T[];
  readonly refreshingItems: T[];
  readonly status: Map<UniqueStatus, T>;
  readonly statuses: Map<T, Statuses>;
}

export interface CreateParams<T> {
  readonly request: Observable<T>;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
}

export interface ReadParams<T> {
  readonly request: Observable<FetchedItems<T> | T[]>;
  readonly onSuccess?: (items: T[]) => void;
  readonly onError?: (error: unknown) => void;
  readonly keepExistingOnError?: boolean;
}

export interface UpdateParams<T> {
  readonly request: Observable<T>;
  readonly refreshRequest?: Observable<T>;
  readonly item: T;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
}

export interface DeleteParams<T, R = unknown> {
  readonly request: Observable<R>;
  readonly item: T;
  readonly onSuccess?: (response: R) => void;
  readonly onError?: (error: unknown) => void;
}

export interface RefreshParams<T> {
  readonly request: Observable<T>;
  readonly item: T;
  readonly onSuccess?: (item: T) => void;
  readonly onError?: (error: unknown) => void;
}

export type DuplicatesMap<T> = Record<number, Record<number, T>>;

@Injectable()
export class CollectionService<T, UniqueStatus = any, Status = any> extends ComponentStore<CollectionState<T, UniqueStatus, Status>> {
  public readonly items$ = this.select(s => s.items);
  public readonly updatingItems$ = this.select(s => s.updatingItems);
  public readonly deletingItems$ = this.select(s => s.deletingItems);
  public readonly refreshingItems$ = this.select(s => s.refreshingItems);
  public readonly mutatingItems$: Observable<T[]> = this.select(
    this.updatingItems$,
    this.deletingItems$,
    (updatingItems, deletingItems) => [...updatingItems, ...deletingItems]
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

  protected comparator: ObjectsComparator = new Comparator();
  protected throwOnDuplicates?: string;
  protected allowFetchedDuplicates: boolean = true;

  protected addToUpdatingItems(item: T) {
    this.patchState((s) => ({
      updatingItems: this.hasItemIn(item, s.updatingItems) ? s.updatingItems : [...s.updatingItems, item]
    }));
  }

  protected removeFromUpdatingItems(item: T) {
    this.patchState((s) => ({
      updatingItems: s.updatingItems.filter(i => !this.comparator.equal(i, item))
    }));
  }

  protected addToDeletingItems(item: T) {
    this.patchState((s) => ({
      deletingItems: this.hasItemIn(item, s.deletingItems) ? s.deletingItems : [...s.deletingItems, item]
    }));
  }

  protected removeFromDeletingItems(item: T) {
    this.patchState((s) => ({
      deletingItems: s.deletingItems.filter(i => !this.comparator.equal(i, item))
    }));
  }

  protected addToRefreshingItems(item: T) {
    this.patchState((s) => ({
      refreshingItems: this.hasItemIn(item, s.refreshingItems) ? s.refreshingItems : [...s.refreshingItems, item]
    }));
  }

  protected removeFromRefreshingItems(item: T) {
    this.patchState((s) => ({
      refreshingItems: s.refreshingItems.filter(i => !this.comparator.equal(i, item))
    }));
  }

  protected has(item: T, items?: T[], excludeIndex?: number) {
    const _items = items ?? this.get().items;
    if (excludeIndex != null) {
      return !!(_items.find((i, j) => j === excludeIndex ? false : this.comparator.equal(item, i)));
    }
    return !!(_items.find((i) => this.comparator.equal(item, i)));
  }

  protected duplicateNotAdded(item: T, items: T[]) {
    if (this.throwOnDuplicates) {
      throw new Error(this.throwOnDuplicates);
    }
    if (console) {
      console.error('Duplicate can not be added to collection:', item, items);
      const duplicates = this.getDuplicates(items);
      if (duplicates) {
        console.error('Duplicates are found in collection:', duplicates);
      }
    }
  }

  protected duplicatesFetched(duplicates: DuplicatesMap<T>) {
    if (this.throwOnDuplicates) {
      throw new Error(this.throwOnDuplicates);
    }
    if (console) {
      console.error('Duplicates found in the list of read items:', duplicates);
    }
  }

  constructor() {
    super({
      items: [],
      updatingItems: [],
      deletingItems: [],
      refreshingItems: [],
      isReading: false,
      isCreating: false,
      statuses: new Map<T, Status>(),
      status: new Map<UniqueStatus, T>(),
    });
  }

  public create(params: CreateParams<T>) {
    this.patchState({isCreating: true});
    return params.request.pipe(
      first(),
      finalize(() => this.patchState({isCreating: false})),
      concatLatestFrom(() => this.items$),
      tapResponse(
        ([item, items]) => {
          if (item != null) {
            if (!this.hasItemIn(item, items)) {
              this.patchState({items: [...items, item]});
              params.onSuccess?.(item);
            } else {
              this.duplicateNotAdded(item, items);
              params.onError?.({status: 409});
            }
          }
        },
        (error) => params.onError?.(error)
      ),
      map(([r]) => r)
    );
  }

  public read(params: ReadParams<T>) {
    this.patchState({isReading: true});
    return params.request.pipe(
      first(),
      finalize(() => this.patchState({isReading: false})),
      tapResponse(
        (fetched) => {
          const items = fetched == null ? ([] as T[]) : (Array.isArray(fetched) ? fetched : fetched.items);
          if (items.length > 0) {
            const duplicates = this.getDuplicates(items);
            if (duplicates) {
              this.duplicatesFetched(duplicates);
              if (!this.allowFetchedDuplicates) {
                params.onError?.({status: 409});
                return;
              }
            }
          }
          this.patchState({
            items,
            totalCountFetched: Array.isArray(fetched) ? undefined : fetched.totalCount,
          });
          params.onSuccess?.(items);
        },
        (error) => {
          if (!params.keepExistingOnError) {
            this.patchState({items: [], totalCountFetched: undefined});
          }
          params.onError?.(error);
        }
      )
    );
  }

  public update(params: UpdateParams<T>) {
    this.addToUpdatingItems(params.item);
    return params.request.pipe(
      first(),
      finalize(() => this.removeFromUpdatingItems(params.item)),
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
              const newItems = [...items];
              const index = newItems.findIndex(i => this.comparator.equal(i, params.item));
              if (index < 0) {
                newItems.push(newItem);
              } else {
                if (!this.has(newItem, newItems, index)) {
                  newItems[index] = newItem;
                } else {
                  this.duplicateNotAdded(newItem, newItems);
                  params.onError?.({status: 409});
                  return newItem;
                }
              }
              this.patchState({items: newItems});
              params.onSuccess?.(newItem);
              return newItem;
            })
          );
        }
      }),
      catchError((error) => {
        params.onError?.(error);
        return EMPTY;
      })
    );
  }

  public delete<R = unknown>(params: DeleteParams<T, R>) {
    this.addToDeletingItems(params.item);
    return params.request.pipe(
      first(),
      finalize(() => this.removeFromDeletingItems(params.item)),
      concatLatestFrom(() => this.items$),
      tapResponse(
        ([response, items]) => {
          this.patchState({
            items: items.filter(item => !this.comparator.equal(item, params.item))
          });
          params.onSuccess?.(response);
        },
        (error) => params.onError?.(error)
      ),
      map(([r]) => r)
    );
  }

  public refresh(params: RefreshParams<T>) {
    this.addToRefreshingItems(params.item);
    return params.request.pipe(
      first(),
      finalize(() => this.removeFromRefreshingItems(params.item)),
      concatLatestFrom(() => this.items$),
      tapResponse(
        ([newItem, items]) => {
          if (newItem != null) {
            const newItems = [...items];
            const index = newItems.findIndex(i => this.comparator.equal(i, params.item));
            if (index < 0) {
              newItems.push(newItem);
            } else {
              if (!this.has(newItem, newItems, index)) {
                newItems[index] = newItem;
              } else {
                console?.error('Duplicate found in collection', newItem, newItems);
                params.onError?.({status: 409});
                return;
              }
            }
            this.patchState({items: newItems});
            params.onSuccess?.(newItem);
          }
        },
        (error) => params.onError?.(error)
      ),
      map(([r]) => r)
    );
  }

  public hasItemIn<I = T>(item: I, arr: I[]) {
    return arr.includes(item) || ((arr.findIndex(i => this.comparator.equal(i, item))) > -1);
  }

  public setUniqueStatus(status: UniqueStatus, item: T, active: boolean = true) {
    if (!active) {
      const current = this.get().status.get(status);
      if (current != null && this.comparator.equal(item, current)) {
        this.deleteUniqueStatus(status);
      } else {
        return;
      }
    } else {
      this.patchState((s) => {
        const newMap = new Map(s.status);
        newMap.set(status, item);
        return {status: newMap};
      });
    }
  }

  public deleteUniqueStatus(status: UniqueStatus) {
    this.patchState((s) => {
      const newMap = new Map(s.status);
      newMap.delete(status);
      return {status: newMap};
    });
  }

  public setItemStatus(item: T, status: Status) {
    this.patchState((s) => {
      const newMap = new Map(s.statuses);
      newMap.set(item, status);
      return {statuses: newMap};
    });
  }

  public getViewModel() {
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

  public getItemViewModel(itemSource: Observable<T | undefined>) {
    return this.select({
      isDeleting: this.select(
        this.deletingItems$,
        itemSource.pipe(startWith(undefined)),
        (items, item) => !!item && this.hasItemIn(item, items)
      ),
      isRefreshing: this.select(
        this.refreshingItems$,
        itemSource.pipe(startWith(undefined)),
        (items, item) => !!item && this.hasItemIn(item, items)
      ),
      isUpdating: this.select(
        this.updatingItems$,
        itemSource.pipe(startWith(undefined)),
        (items, item) => !!item && this.hasItemIn(item, items)
      ),
      isMutating: this.select(
        this.mutatingItems$,
        itemSource.pipe(startWith(undefined)),
        (items, item) => !!item && this.hasItemIn(item, items)
      ),
      isProcessing: this.select(
        this.isProcessing$,
        this.refreshingItems$,
        this.mutatingItems$,
        itemSource.pipe(startWith(undefined)),
        (isProcessing, refreshingItems, mutatingItems, item) => !!item
          && isProcessing
          && (this.hasItemIn(item, refreshingItems) || this.hasItemIn(item, mutatingItems))
      ),
    });
  }

  public setComparator(comparator: ObjectsComparator) {
    this.comparator = comparator;
  }

  public getDuplicates(items: T[]): DuplicatesMap<T> | null {
    const duplicates: DuplicatesMap<T> = {};
    const indexes: number[] = [];
    items.forEach((i, ii) => {
      if (!indexes.includes(ii)) {
        const iDupes: Record<number, T> = {};
        items.forEach((j, ij) => {
          if (ij !== ii && this.comparator.equal(i, j)) {
            iDupes[ij] = j;
            if (!indexes.includes(ii)) {
              indexes.push(ii);
            }
            if (!indexes.includes(ij)) {
              indexes.push(ij);
            }
          }
        });
        if (Object.keys(iDupes).length) {
          iDupes[ii] = i;
          duplicates[ii] = iDupes;
        }
      }
    });
    return Object.keys(duplicates).length ? duplicates : null;
  }

  public setThrowOnDuplicates(message: string | undefined) {
    this.throwOnDuplicates = message;
  }

  public setAllowFetchedDuplicates(allowFetchedDuplicates: boolean) {
    this.allowFetchedDuplicates = allowFetchedDuplicates;
  }

  public getTrackByFieldFn(field: string) {
    return (i: number, item: any) => (!!item && typeof item === 'object' && item.hasOwnProperty(field) && item[field]) ? item[field] : i;
  }
}
