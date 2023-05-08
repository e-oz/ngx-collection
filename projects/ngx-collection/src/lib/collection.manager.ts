import { Comparator, ObjectsComparator, ObjectsComparatorFn } from './comparator';
import { CollectionServiceOptions, DuplicatesMap } from './collection.service.types';

export class CollectionManager<T, UniqueStatus = unknown, Status = unknown> {
  public comparator: ObjectsComparator = new Comparator();
  public throwOnDuplicates?: string;
  public allowFetchedDuplicates: boolean = true;
  public onDuplicateErrCallbackParam = {status: 409};
  public errReporter?: (...args: any[]) => any;

  public setComparator(comparator: ObjectsComparator | ObjectsComparatorFn) {
    if (typeof comparator === 'function') {
      this.comparator = {equal: comparator};
    } else {
      this.comparator = comparator;
    }
  }

  public setOptions(options?: CollectionServiceOptions | null) {
    if (options != null) {
      if (options.comparator) {
        this.setComparator(options.comparator);
      } else {
        if (options.comparatorFields != null) {
          this.comparator = new Comparator(options.comparatorFields);
        }
      }
      if (options.throwOnDuplicates) {
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

  public has(item: Partial<T>, items: Partial<T>[], excludeIndex?: number): boolean {
    if (excludeIndex != null) {
      return !!(items.find((i, j) => j === excludeIndex ? false : this.comparator.equal(item, i)));
    }
    return !!(items.find((i) => this.comparator.equal(item, i)));
  }

  public getWith(items: T[], item: Partial<T> | Partial<T>[]): T[] {
    const addItems = Array.isArray(item) ?
      item.map(i => this.getItemByPartial(i, items) ?? i as T)
      : [this.getItemByPartial(item, items) ?? item as T];
    return this.uniqueItems([
      ...items,
      ...addItems
    ]);
  }

  public getWithout(items: T[], item: Partial<T> | Partial<T>[]): T[] {
    if (Array.isArray(item)) {
      return items.filter(i => !this.has(i, item));
    } else {
      return items.filter(i => !this.comparator.equal(i, item));
    }
  }

  public getItemByPartial(partItem: Partial<T>, items: T[]): T | undefined {
    return items.find(i => this.comparator.equal(i, partItem));
  }

  public upsertOne(item: T, items: T[]): T[] | 'duplicate' {
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

  public hasDuplicates(items: T[]): T | null {
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

  public upsertMany(items: T[], toItems: T[]): T[] | {
    duplicate: T,
    preExisting?: boolean
  } {
    const hasDuplicates = this.hasDuplicates(items);
    if (hasDuplicates) {
      return {duplicate: hasDuplicates};
    }
    for (let i = 0; i < items.length; i++) {
      if (this.upsertOne(items[i], toItems) === 'duplicate') {
        return {duplicate: items[i]};
      }
    }
    return toItems;
  }

  public duplicateNotAdded(item: T, items: T[]) {
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

  public callCb(cb: ((_: any) => any) | undefined, param: any) {
    if (cb != null) {
      try {
        cb(param);
      } catch (e) {
        this.reportRuntimeError(e);
      }
    }
  }

  public callErrReporter(...args: any) {
    if (this.errReporter) {
      try {
        this.errReporter(...args);
      } catch (e) {
        console?.error('errReporter threw an exception', e);
      }
    }
  }

  public reportRuntimeError(...args: any) {
    if (this.errReporter) {
      this.callErrReporter(...args);
    } else {
      console?.error(...args);
    }
  }

  public getDecrementedTotalCount<R>(
    response: R[],
    itemsCount: number,
    prevTotalCount?: number,
    decrementTotalCount?: boolean | number | string,
  ): number | null {
    try {
      if (decrementTotalCount != null) {
        if (typeof decrementTotalCount === 'string') {
          if (response.length === 1
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

  public setUniqueStatus(map: Map<UniqueStatus, T>, status: UniqueStatus, item: T, active: boolean = true): Map<UniqueStatus, T> {
    if (!active) {
      const current = map.get(status);
      if (current != null && this.comparator.equal(item, current)) {
        const newMap = new Map(map);
        newMap.delete(status);
        return newMap;
      } else {
        return map;
      }
    } else {
      const newMap = new Map(map);
      newMap.set(status, item);
      return newMap;
    }
  }

  public deleteUniqueStatus(map: Map<UniqueStatus, T>, status: UniqueStatus): Map<UniqueStatus, T> {
    const newMap = new Map(map);
    newMap.delete(status);
    return newMap;
  }

  public setItemStatus(map: Map<T, Set<Status>>, item: T, status: Status): Map<T, Set<Status>> {
    const newMap = new Map(map);
    const itemStatuses = newMap.get(item) ?? new Set<Status>();
    itemStatuses.add(status);
    newMap.set(item, itemStatuses);
    return newMap;
  }

  public deleteItemStatus(map: Map<T, Set<Status>>, item: T, status: Status): Map<T, Set<Status>> {
    const newMap = new Map(map);
    const itemStatuses = newMap.get(item);
    if (itemStatuses) {
      itemStatuses.delete(status);
      newMap.set(item, itemStatuses);
      return newMap;
    } else {
      return map;
    }
  }
}