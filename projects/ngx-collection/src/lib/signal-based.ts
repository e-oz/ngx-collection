import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';

export type SignalBasedCollection<T, UniqueStatus = unknown, Status = unknown> = {
  items: Signal<T[]>;
  totalCountFetched: Signal<number | undefined>;
  isCreating: Signal<boolean>;
  isReading: Signal<boolean>;
  updatingItems: Signal<T[]>;
  deletingItems: Signal<T[]>;
  refreshingItems: Signal<T[]>;
  status: Signal<Map<UniqueStatus, T>>;
  statuses: Signal<Map<T, Set<Status>>>;
  isUpdating: Signal<boolean>;
  isDeleting: Signal<boolean>;
  isMutating: Signal<boolean>;
  isSaving: Signal<boolean>;
  isProcessing: Signal<boolean>;
  mutatingItems: Signal<T[]>;

  /**
   * Creates a signal containing an item. Returned signal will be updated every time `filter` is updated.
   * @param filter - (partial) item to be compared with. Also accepts observables and signals.
   */
  getItem(filter: Partial<T> | Observable<Partial<T>> | Signal<Partial<T>>): Signal<T | undefined>;

  /**
   * Creates a signal containing an item. Returned signal will be updated every time `fieldValue` is updated.
   * @param field - one field or array of the fields, that item can have (type-checked).
   * @param fieldValue - value (type-checked), also accepts observables and signals.   */
  getItemByField<K extends keyof T>(field: K | K[], fieldValue: T[K] | Observable<T[K]> | Signal<T[K]>): Signal<T | undefined>;
}
