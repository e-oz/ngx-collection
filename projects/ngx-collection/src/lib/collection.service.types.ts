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
  comparatorFields?: (string | string[])[];
  comparator?: ObjectsComparator | ObjectsComparatorFn;
  throwOnDuplicates?: string;
  allowFetchedDuplicates?: boolean;
  onDuplicateErrCallbackParam?: any;
  errReporter?: (...args: any[]) => any;
}
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