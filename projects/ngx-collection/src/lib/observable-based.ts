import type { Observable } from 'rxjs';
import type { Signal } from '@angular/core';

export type ViewModel<T, UniqueStatus = any, Status = any> = {
  readonly items: T[];
  readonly totalCountFetched: number | undefined;
  readonly isCreating: boolean;
  readonly isReading: boolean;
  readonly isUpdating: boolean;
  readonly isDeleting: boolean;
  readonly isMutating: boolean;
  readonly isSaving: boolean;
  readonly isProcessing: boolean;
  readonly updatingItems: T[];
  readonly deletingItems: T[];
  readonly mutatingItems: T[];
  readonly refreshingItems: T[];
  readonly statuses: Map<T, Set<Status>>;
  readonly status: Map<UniqueStatus, T>;
}
export type ItemViewModel = {
  readonly isDeleting: boolean;
  readonly isRefreshing: boolean;
  readonly isUpdating: boolean;
  readonly isMutating: boolean;
  readonly isProcessing: boolean;
}

export interface ObservableBasedCollection<T, UniqueStatus = unknown, Status = unknown> {
  items$: Observable<T[]>;
  totalCountFetched$: Observable<number | undefined>;
  updatingItems$: Observable<T[]>;
  deletingItems$: Observable<T[]>;
  refreshingItems$: Observable<T[]>;
  mutatingItems$: Observable<T[]>;
  isCreating$: Observable<boolean>;
  isReading$: Observable<boolean>;
  isUpdating$: Observable<boolean>;
  isDeleting$: Observable<boolean>;
  isSaving$: Observable<boolean>;
  isMutating$: Observable<boolean>;
  isProcessing$: Observable<boolean>;
  statuses$: Observable<Map<T, Set<Status>>>;
  status$: Observable<Map<UniqueStatus, T>>;

  itemsSignal: Signal<T[]>;
  totalCountFetchedSignal: Signal<number | undefined>;
  updatingItemsSignal: Signal<T[]>;
  deletingItemsSignal: Signal<T[]>;
  refreshingItemsSignal: Signal<T[]>;
  mutatingItemsSignal: Signal<T[]>;
  isCreatingSignal: Signal<boolean>;
  isReadingSignal: Signal<boolean>;
  isUpdatingSignal: Signal<boolean>;
  isDeletingSignal: Signal<boolean>;
  isSavingSignal: Signal<boolean>;
  isMutatingSignal: Signal<boolean>;
  isProcessingSignal: Signal<boolean>;
  statusesSignal: Signal<Map<T, Set<Status>>>;
  statusSignal: Signal<Map<UniqueStatus, T>>;

  /**
   * Get ViewModel dictionary of observables.
   *
   * Designed to be used with async pipe:
   * ```html
   *
   * <ng-container *ngIf="viewModel$ | async as $">
   *   <spinner *ngIf="$.isReading"></spinner>
   * </ng-container>
   *
   * ```
   */
  getViewModel(): Observable<ViewModel<T, UniqueStatus, Status>>;

  getViewModelSignal(): Signal<ViewModel<T, UniqueStatus, Status>>;

  /**
   * Get ViewModel for an item.
   */
  getItemViewModel(itemSource: Observable<T | undefined> | Signal<T | undefined>): Observable<ItemViewModel>;

  getItemViewModelSignal(itemSource: Observable<T | undefined> | Signal<T | undefined>): Signal<ItemViewModel>;

  /**
   * Creates an item selector.
   * @param filter - (partial) item to be compared with. Also accepts observables and signals.
   */
  getItem(filter: Partial<T> | Observable<Partial<T>> | Signal<Partial<T>>): Observable<T | undefined>;

  getItemSignal(filter: Partial<T> | Observable<Partial<T>> | Signal<Partial<T>>): Signal<T | undefined>;

  /**
   * Creates an item selector.
   * @param field - one field or array of the fields, that item can have (type-checked).
   * @param fieldValue - value (type-checked), also accepts observables and signals.
   */
  getItemByField<K extends keyof T>(field: K | K[], fieldValue: T[K] | Observable<T[K]> | Signal<T[K]>): Observable<T | undefined>;

  getItemByFieldSignal<K extends keyof T>(field: K | K[], fieldValue: T[K] | Observable<T[K]> | Signal<T[K]>): Signal<T | undefined>;
}