import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { defer, map, of, Subject, switchMap, throwError, timer } from 'rxjs';
import { Collection } from '../collection';

// Initialize TestBed environment
if (!TestBed.platform) {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

type Item = {
  id: number;
  name: string;
}

function setup() {
  const coll = new Collection<Item>({ throwOnDuplicates: 'duplicate', comparatorFields: ['id'] });

  return {
    coll,
  };
}

function emit<T>(result: T) {
  return timer(1).pipe(map(() => result));
}

describe('Collection Service (async)', () => {
  it('create', () => {
    const { coll } = setup();
    const newItem: Item = { id: 0, name: ':)' };

    expect(coll.$isCreating()).toBe(false);
    expect(coll.$isProcessing()).toBe(false);
    expect(coll.$isMutating()).toBe(false);

    coll.create({
      request: emit(newItem),
    }).subscribe();

    expect(coll.$isCreating()).toBe(true);
    expect(coll.$isProcessing()).toBe(true);
    expect(coll.$isMutating()).toBe(true);

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([newItem]);
    expect(coll.$isCreating()).toBe(false);
    expect(coll.$isProcessing()).toBe(false);
    expect(coll.$isMutating()).toBe(false);

    const secondItem: Item = { id: -1, name: ';)' };

    coll.create({
      request: of(secondItem)
    }).subscribe();

    expect(coll.$items()).toStrictEqual([newItem, secondItem]);

    coll.create({
      request: of(secondItem)
    }).subscribe();

    expect(coll.$items()).toStrictEqual([newItem, secondItem]);
  });

  it('create many', () => {
    const { coll } = setup();

    const item1 = { id: -1, name: 'A' };
    const item2 = { id: 0, name: 'B' };
    const item3 = { id: 1, name: 'C' };
    const item4 = { id: 2, name: 'D' };
    const item5 = { id: 2, name: 'E' };
    const item6 = { id: 3, name: 'F' };
    const item7 = { id: 4, name: 'G' };

    coll.read({
      request: of([item1])
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1]);

    coll.createMany({
      request: emit([item2, item3]),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1]);
    expect(coll.$isCreating()).toBe(true);
    expect(coll.$isUpdating()).toBe(false);
    expect(coll.$isProcessing()).toBe(true);
    expect(coll.$isMutating()).toBe(true);
    expect(coll.$isSaving()).toBe(true);

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([item1, item2, item3]);
    expect(coll.$isCreating()).toBe(false);
    expect(coll.$isUpdating()).toBe(false);
    expect(coll.$isProcessing()).toBe(false);
    expect(coll.$isMutating()).toBe(false);
    expect(coll.$isSaving()).toBe(false);

    // should not mutate - item5 is a duplicate of item4
    coll.createMany({
      request: [emit(item4), emit(item5)],
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([item1, item2, item3]);

    coll.createMany({
      request: [emit(item4), emit(item6)],
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item4, item6]);

    coll.createMany({
      request: of({ items: [item7], totalCount: 0 }),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item4, item6, item7]);
    expect(coll.$totalCountFetched()).toStrictEqual(0);

    coll.createMany({
      request: emit({ items: [], totalCount: 4815162342 }),
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item4, item6, item7]);
    expect(coll.$totalCountFetched()).toStrictEqual(4815162342);
  });

  it('read', () => {
    const { coll } = setup();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$isBeforeFirstRead()).toBeTruthy();

    coll.read({
      request: emit([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]),
      items: [{ id: 1 }, { id: 2 }]
    }).subscribe();

    expect(coll.$isReading()).toStrictEqual(true);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$isBeforeFirstRead()).toBeTruthy();
    expect(coll.$readingItems()).toStrictEqual([{ id: 1 }, { id: 2 }]);
    expect(coll.isItemReading({ id: 2 })()).toBeTruthy();
    expect(coll.isItemReading(signal({ id: 1 }))()).toBeTruthy();
    expect(coll.isItemReading({ id: 3 })()).toBeFalsy();
    expect(coll.isItemReading(signal({ id: 3 }))()).toBeFalsy();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    expect(coll.$isBeforeFirstRead()).toBeFalsy();
    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$readingItems()).toStrictEqual([]);
    expect(coll.isItemReading({ id: 2 })()).toBeFalsy();
    expect(coll.isItemReading(signal({ id: 1 }))()).toBeFalsy();

    coll.read({
      request: of({ items: [{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }], totalCount: 12 })
    }).subscribe();

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }]);
    expect(coll.$totalCountFetched()).toStrictEqual(12);

    coll.setAllowFetchedDuplicates(false);
    coll.setThrowOnDuplicates(undefined);

    coll.read({
      request: of({ items: [{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }, { id: 2, name: 'BNX' }], totalCount: 10000 }),
      keepExistingOnError: true,
    }).subscribe();

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }]);
    expect(coll.$totalCountFetched()).toStrictEqual(12);

    coll.read({
      request: of({ items: [{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }, { id: 2, name: 'BNX' }], totalCount: 10000 }),
      keepExistingOnError: false,
    }).subscribe();

    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$totalCountFetched()).toStrictEqual(undefined);

    coll.read({
      request: of({ items: [{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }, { id: 2, name: 'BNX' }] })
    }).subscribe();

    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$totalCountFetched()).toStrictEqual(undefined);
  });

  it('read one', () => {
    const { coll } = setup();
    const item: Item = { id: 0, name: 'A' };
    const item1: Item = { id: 1, name: 'B' };
    const item2: Item = { id: 2, name: 'C' };
    const item3: Item = { id: 3, name: 'D' };
    const item3v2: Item = { id: 3, name: 'E' };

    coll.read({ request: of([item1, item2, item3]) }).subscribe();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$items()).toStrictEqual([item1, item2, item3]);

    coll.readOne({
      request: emit(item),
      item: { id: 0 },
    }).subscribe();

    expect(coll.$isReading()).toStrictEqual(true);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$readingItems()).toStrictEqual([{ id: 0 }]);
    expect(coll.isItemReading(item)()).toBeTruthy();
    expect(coll.isItemReading(signal(item))()).toBeTruthy();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item]);
    expect(coll.$readingItems()).toStrictEqual([]);
    expect(coll.isItemReading(item)()).toBeFalsy();
    expect(coll.isItemReading(signal(item))()).toBeFalsy();

    coll.readOne({
      request: emit(item3v2),
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$items()).toStrictEqual([item1, item2, item3v2, item]);

  });

  it('read many', () => {
    const { coll } = setup();
    const items: Item[] = [{ id: 0, name: 'A' }, { id: 1, name: 'B' }, { id: 2, name: 'C' }];
    const newItems: Item[] = [{ id: 3, name: 'D' }, { id: 4, name: 'E' }];
    const newItemsV2 = { items: [{ id: 3, name: 'D!' }, { id: 4, name: 'E!' }], totalCount: 4815162342 };

    coll.read({ request: of(items) }).subscribe();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$items()).toStrictEqual(items);

    coll.readMany({
      request: emit(newItems),
      items: [{ id: 3 }, { id: 4 }],
    }).subscribe();

    expect(coll.$isReading()).toStrictEqual(true);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$readingItems()).toStrictEqual([{ id: 3 }, { id: 4 }]);
    expect(coll.isItemReading({ id: 3 })()).toBeTruthy();
    expect(coll.isItemReading(signal({ id: 4 }))()).toBeTruthy();
    expect(coll.isItemReading({ id: 2 })()).toBeFalsy();

    jest.runAllTimers();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$items()).toStrictEqual([...items, ...newItems]);
    expect(coll.$readingItems()).toStrictEqual([]);
    expect(coll.isItemReading({ id: 3 })()).toBeFalsy();
    expect(coll.isItemReading(signal({ id: 4 }))()).toBeFalsy();

    coll.readMany({
      request: emit(newItemsV2),
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$totalCountFetched()).toStrictEqual(4815162342);
    expect(coll.$items()).toStrictEqual([...items, ...newItemsV2.items]);

  });

  it('refresh', () => {
    const { coll } = setup();
    const item1 = { id: 0, name: 'A' };
    const item2 = { id: 1, name: 'B' };
    const item3 = { id: 2, name: 'C' };
    const item4 = { id: 3, name: 'D' };
    const item1f = { id: 0, name: 'Af' };
    const item2f = { id: 1, name: 'Bf' };
    const item3f = { id: 2, name: 'Cf' };
    const item4f = { id: 3, name: 'Df' };

    coll.read({ request: of([item1, item2]) }).subscribe();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$refreshingItems()).toEqual([]);
    expect(coll.$processingItems()).toEqual([]);
    expect(coll.$items()).toStrictEqual([item1, item2]);

    coll.refresh({
      request: emit(item2f),
      item: item2
    }).subscribe();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$refreshingItems()).toEqual([item2]);
    expect(coll.$processingItems()).toEqual([item2]);
    expect(coll.$items()).toStrictEqual([item1, item2]);
    expect(coll.isItemRefreshing(item2)()).toBe(true);
    expect(coll.isItemProcessing(item2)()).toBe(true);
    expect(coll.isItemMutating(item2)()).toBe(false);
    expect(coll.isItemDeleting(item2)()).toBe(false);
    expect(coll.isItemUpdating(item2)()).toBe(false);

    jest.runAllTimers();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$refreshingItems()).toEqual([]);
    expect(coll.$items()).toStrictEqual([item1, item2f]);
    expect(coll.isItemRefreshing(item2)()).toBe(false);
    expect(coll.isItemProcessing(item2)()).toBe(false);
    expect(coll.isItemMutating(item2)()).toBe(false);
    expect(coll.isItemDeleting(item2)()).toBe(false);
    expect(coll.isItemUpdating(item2)()).toBe(false);

    coll.refreshMany({
      request: emit([item1f, item3]),
      items: [item1]
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$refreshingItems()).toEqual([]);
    expect(coll.$items()).toStrictEqual([item1f, item2f, item3]);

    coll.refreshMany({
      request: [emit(item3f), emit(item4)],
      items: [item3]
    }).subscribe();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$refreshingItems()).toEqual([item3]);
    expect(coll.$items()).toStrictEqual([item1f, item2f, item3]);

    jest.runOnlyPendingTimers();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$refreshingItems()).toEqual([]);
    expect(coll.$items()).toStrictEqual([item1f, item2f, item3f, item4]);

    coll.refreshMany({
      request: emit({ items: [item2f, item3f, item4f], totalCount: 4815162342 }),
      items: [item3f, item4]
    }).subscribe();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$refreshingItems()).toEqual([item3f, item4]);
    expect(coll.$items()).toStrictEqual([item1f, item2f, item3f, item4]);
    expect(coll.$totalCountFetched()).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(coll.$isReading()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$refreshingItems()).toEqual([]);
    expect(coll.$items()).toStrictEqual([item1f, item2f, item3f, item4f]);
    expect(coll.$totalCountFetched()).toStrictEqual(4815162342);
  });

  it('update', () => {
    const { coll } = setup();

    const item1 = { id: -1, name: 'A' };
    const item2 = { id: 0, name: 'B' };

    const item2Signal = signal(item2);

    expect(coll.$isUpdating()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);

    coll.read({
      request: of([item1, item2])
    }).subscribe();

    const newItem2 = { id: 0, name: 'C' };

    expect(coll.$isUpdating()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);

    expect(coll.$updatingItems().length).toEqual(0);

    coll.update({
      request: emit(newItem2),
      item: item2,
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2]);
    expect(coll.$updatingItems()).toStrictEqual([item2]);
    expect(coll.$mutatingItems()).toStrictEqual([item2]);
    expect(coll.isItemUpdating(item2Signal)()).toStrictEqual(true);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(true);
    expect(coll.isItemProcessing(item2Signal)()).toStrictEqual(true);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(true);
    expect(coll.isItemMutating(item2Signal)()).toStrictEqual(true);
    expect(coll.isItemMutating(item2)()).toStrictEqual(true);
    expect(coll.$isUpdating()).toStrictEqual(true);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(true);

    jest.runOnlyPendingTimers();

    expect(coll.$items()).toStrictEqual([item1, newItem2]);
    expect(coll.$updatingItems()).toStrictEqual([]);
    expect(coll.$mutatingItems()).toStrictEqual([]);
    expect(coll.isItemUpdating(item2Signal)()).toStrictEqual(false);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(false);
    expect(coll.isItemProcessing(item2Signal)()).toStrictEqual(false);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(false);
    expect(coll.isItemMutating(item2Signal)()).toStrictEqual(false);
    expect(coll.isItemMutating(item2)()).toStrictEqual(false);
    expect(coll.$isUpdating()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
  });

  it('update many', () => {
    const { coll } = setup();

    const item1 = { id: -1, name: 'A' };
    const item2 = { id: 0, name: 'B' };
    const item3 = { id: 1, name: 'C' };
    const item4 = { id: 2, name: 'D' };

    coll.read({
      request: of([item1, item2, item3, item4])
    }).subscribe();

    const newItem2 = { id: 0, name: 'X' };
    const newItem4 = { id: 2, name: 'Y' };

    coll.updateMany({
      request: emit([newItem2, newItem4]),
      items: [item2, item4],
    }).subscribe();

    expect(coll.$updatingItems()).toStrictEqual([item2, item4]);
    expect(coll.$mutatingItems()).toStrictEqual([item2, item4]);
    expect(coll.$isUpdating()).toStrictEqual(true);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(true);
    expect(coll.$isSaving()).toStrictEqual(true);

    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(true);

    expect(coll.isItemUpdating(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item3))()).toStrictEqual(false);

    expect(coll.isItemUpdating(signal(item4))()).toStrictEqual(true);
    expect(coll.isItemMutating(signal(item4))()).toStrictEqual(true);
    expect(coll.isItemProcessing(signal(item4))()).toStrictEqual(true);

    jest.runOnlyPendingTimers();

    expect(coll.$items()).toStrictEqual([item1, newItem2, item3, newItem4]);
    expect(coll.$updatingItems()).toStrictEqual([]);
    expect(coll.$isUpdating()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$isSaving()).toStrictEqual(false);

    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);

    expect(coll.isItemUpdating(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item3))()).toStrictEqual(false);

    expect(coll.isItemUpdating(signal(item4))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item4))()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item4))()).toStrictEqual(false);
  });

  it('delete', () => {
    const { coll } = setup();

    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 0, name: 'B' };
    const item3 = { id: 3, name: 'B3' };
    const item4 = { id: 4, name: 'B4' };
    const item5 = { id: 5, name: 'B5' };
    const item6 = { id: 6, name: 'B6' };
    const item7 = { id: 7, name: 'B7' };

    coll.read({
      request: of({
        items: [
          item1,
          item2,
          item3,
          item4,
          item5,
          item6,
          item7,
        ],
        totalCount: 7
      }),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([
      item1,
      item2,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.$deletingItems()).toStrictEqual([]);
    expect(coll.$isDeleting()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isSaving()).toStrictEqual(false);
    expect(coll.$totalCountFetched()).toStrictEqual(7);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(item2)()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(item2)()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(item2)()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(false);

    coll.delete({
      request: emit(item2),
      item: item2,
    }).subscribe();

    expect(coll.$items()).toStrictEqual([
      item1,
      item2,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.$deletingItems()).toStrictEqual([item2]);
    expect(coll.$isDeleting()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(true);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isSaving()).toStrictEqual(false);
    expect(coll.$totalCountFetched()).toStrictEqual(7);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(true);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemMutating(item2)()).toStrictEqual(true);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemDeleting(item2)()).toStrictEqual(true);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(item2)()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(false);

    jest.runOnlyPendingTimers();

    expect(coll.$items()).toStrictEqual([
      item1,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.$deletingItems()).toStrictEqual([]);
    expect(coll.$isDeleting()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isSaving()).toStrictEqual(false);
    expect(coll.$totalCountFetched()).toStrictEqual(7);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(item2)()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(item2)()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(item2)()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(false);

    coll.delete({
      request: of(null),
      item: item3,
      decrementTotalCount: 3,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.$totalCountFetched()).toStrictEqual(4);

    coll.delete({
      request: of(null),
      item: item4,
      decrementTotalCount: true,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.$totalCountFetched()).toStrictEqual(3);

    coll.delete({
      request: of({ totalItems: 1 }),
      item: item5,
      decrementTotalCount: 'totalItems',
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.$totalCountFetched()).toStrictEqual(1);
  });

  it('delete many', () => {
    const { coll } = setup();

    const item1 = { id: -1, name: 'A' };
    const item2 = { id: 0, name: 'B' };
    const item3 = { id: 1, name: 'C' };
    const item4 = { id: 2, name: 'D' };
    const item5 = { id: 5, name: 'B5' };
    const item6 = { id: 6, name: 'B6' };
    const item7 = { id: 7, name: 'B7' };
    const item8 = { id: 8, name: 'B8' };
    const item9 = { id: 9, name: 'B9' };

    coll.read({
      request: of({
        items: [item1, item2, item3, item4, item5, item6, item7, item8, item9],
        totalCount: 200
      })
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item4, item5, item6, item7, item8, item9]);
    expect(coll.$deletingItems()).toStrictEqual([]);
    expect(coll.$isDeleting()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isSaving()).toStrictEqual(false);
    expect(coll.$totalCountFetched()).toStrictEqual(200);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);

    coll.deleteMany({
      request: emit('ok'),
      items: [item3, item4],
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item4, item5, item6, item7, item8, item9]);
    expect(coll.$deletingItems()).toStrictEqual([item3, item4]);
    expect(coll.$isDeleting()).toStrictEqual(true);
    expect(coll.$isMutating()).toStrictEqual(true);
    expect(coll.$isProcessing()).toStrictEqual(true);
    expect(coll.$isSaving()).toStrictEqual(false);
    expect(coll.$totalCountFetched()).toStrictEqual(200);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);

    jest.runOnlyPendingTimers();

    expect(coll.$items()).toStrictEqual([item1, item2, item5, item6, item7, item8, item9]);
    expect(coll.$deletingItems()).toStrictEqual([]);
    expect(coll.$isDeleting()).toStrictEqual(false);
    expect(coll.$isMutating()).toStrictEqual(false);
    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.$isSaving()).toStrictEqual(false);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);

    coll.deleteMany({
      request: emit('ok'),
      items: [item5],
      decrementTotalCount: 110,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.$totalCountFetched()).toStrictEqual(90);

    coll.deleteMany({
      request: emit('ok'),
      items: [item6, item7],
      decrementTotalCount: true,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.$totalCountFetched()).toStrictEqual(88);

    coll.deleteMany({
      request: emit({ total: 10 }),
      items: [item8],
      decrementTotalCount: 'total',
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.$totalCountFetched()).toStrictEqual(10);
  });

  it('status', () => {
    const { coll } = setup();

    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };

    coll.read({ request: of([item1, item2]) }).subscribe();
    expect(coll.$items()).toStrictEqual([item1, item2]);

    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item1))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item1))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item1))()).toStrictEqual(false);
    expect(coll.$statuses().get(item1)?.has('selected')).toBeFalsy();

    coll.setItemStatus(item1, 'selected');

    expect(coll.$isProcessing()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item1))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item1))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item1))()).toStrictEqual(false);
    expect(coll.$statuses().get(item1)?.has('selected')).toBeTruthy();

    coll.setItemStatus(item1, 'awesome');

    expect(coll.$statuses().get(item1)?.has('selected')).toBeTruthy();
    expect(coll.$statuses().get(item1)?.has('awesome')).toBeTruthy();

    coll.deleteItemStatus(item1, 'awesome');

    expect(coll.$statuses().get(item1)?.has('selected')).toBeTruthy();
    expect(coll.$statuses().get(item1)?.has('awesome')).toBeFalsy();

    coll.deleteItemStatus(item1, 'selected');

    expect(coll.$statuses().get(item1)?.has('selected')).toBeFalsy();
    expect(coll.$statuses().get(item1)?.has('awesome')).toBeFalsy();

    coll.setItemStatus(item1, 'awesome');

    expect(coll.$statuses().get(item1)?.has('awesome')).toBeTruthy();
  });

  it('unique status', () => {
    const { coll } = setup();

    const item1 = { id: -1, name: '#!' };
    const item2 = { id: 0, name: '!@' };

    coll.read({ request: of([item1, item2]) }).subscribe();
    expect(coll.$items()).toStrictEqual([item1, item2]);

    expect(coll.$status().get('focused')).toBeFalsy();

    coll.setUniqueStatus('focused', item2);
    coll.setUniqueStatus('reserved', item2);

    expect(coll.$status().get('focused')).toStrictEqual(item2);

    coll.setUniqueStatus('chosen', item1);

    expect(coll.$status().get('focused')).toStrictEqual(item2);
    expect(coll.$status().get('chosen')).toStrictEqual(item1);
    expect(coll.$status().get('reserved')).toStrictEqual(item2);

    coll.setUniqueStatus('chosen', item2, false);

    expect(coll.$status().get('chosen')).toStrictEqual(item1);

    coll.setUniqueStatus('chosen', item1, false);

    expect(coll.$status().get('chosen')).toBeFalsy();

    coll.deleteUniqueStatus('focused');

    expect(coll.$status().get('focused')).toBeFalsy();
    expect(coll.$status().get('chosen')).toBeFalsy();

    expect(coll.$status().get('reserved')).toStrictEqual(item2);
    coll.setUniqueStatus('reserved', item1);
    expect(coll.$status().get('reserved')).toStrictEqual(item1);
  });

  it('getItem', () => {
    const { coll } = setup();

    expect(coll.getItem({ id: 1 })()).toStrictEqual(undefined);

    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };
    const item3 = { id: 3, name: 'C' };

    coll.read({
      request: emit([item1, item2, item3])
    }).subscribe();

    expect(coll.getItem({ id: 1 })()).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(coll.getItem({ id: 1 })()).toStrictEqual(item1);

    const itemSource = coll.getItem(item2);

    expect(itemSource()).toStrictEqual(item2);
  });

  it('getItemByField', () => {
    const { coll } = setup();

    expect(coll.getItemByField('id', 1)()).toStrictEqual(undefined);

    const item1 = { id: 0, name: '!' };
    const item2 = { id: -1, name: '?' };
    const item3 = { id: 1, name: '*' };

    coll.read({
      request: emit([item1, item2, item3])
    }).subscribe();

    expect(coll.getItemByField('id', 1)()).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(coll.getItemByField('id', 0)()).toStrictEqual(item1);
    expect(coll.getItemByField(['id', 'name'], -1)()).toStrictEqual(item2);
    expect(coll.getItemByField(['id', 'name'], '*')()).toStrictEqual(item3);

    const itemSource = coll.getItemByField('id', signal(0));

    expect(itemSource()).toStrictEqual(item1);
  });

  it('custom comparator fn with multiple fields', () => {
    const { coll } = setup();
    coll.setOptions({
      comparator: (item1: Item, item2: Item) => (item1.id + item1.name) === (item2.id + item2.name),
      allowFetchedDuplicates: false,
      onDuplicateErrCallbackParam: 'DRY',
      throwOnDuplicates: false
    });

    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };
    const item3 = { id: 1, name: 'B' };
    const item4 = { id: 2, name: 'B' };

    let errMsg = '';

    coll.read({
      request: of([item1, item2, item3, item4]),
      onError: (err: any) => errMsg = err as string,
    }).subscribe();

    expect(errMsg).toBe('DRY');
    expect(coll.getDuplicates([item1, item2, item3, item4])).toMatchObject(
      {
        '1': {
          '1': { 'id': 2, 'name': 'B' },
          '3': { 'id': 2, 'name': 'B' }
        }
      }
    );
  });

  it('should emit onCreate', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForCreate().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.create({
      request: emit({ id: 1, name: 'A' })
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('should emit onCreate for createMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForCreate().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.createMany({
      request: emit([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  });

  it('should not emit onCreate without subscribers', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    const s = coll.listenForCreate().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();
    s.unsubscribe();

    coll.create({
      request: emit({ id: 1, name: 'A' })
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual(undefined);
  });

  it('should emit onRead', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.read({
      request: emit([{ id: 1, name: 'A' }])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('should emit onRead for readMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.readMany({
      request: emit([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  });

  it('should emit onRead for refresh', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{ id: 1, name: 'A' }])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }]);

    coll.refresh({
      request: emit({ id: 1, name: 'B' }),
      item: { id: 1 },
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }]);
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'B' }]);
  });

  it('should emit onRead for refreshMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);

    coll.refreshMany({
      request: emit([{ id: 1, name: 'C' }, { id: 2, name: 'D' }]),
      items: [{ id: 1 }, { id: 2 }],
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'C' }, { id: 2, name: 'D' }]);
  });

  it('should emit onUpdate', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForUpdate().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{ id: 1, name: 'A' }])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.update({
      request: emit({ id: 1, name: 'B' }),
      item: { id: 1 },
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'B' }]);
  });

  it('should emit onItemsUpdate', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };

    let lastEmitted: any = undefined;
    coll.listenForItemsUpdate([item]).subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([item])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toStrictEqual([item]);
    lastEmitted = undefined;

    coll.update({
      request: emit({ id: 1, name: 'B' }),
      item: item,
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'B' }]);
  });

  it('should emit onUpdate for updateMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForUpdate().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{ id: 1, name: 'A' }])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.updateMany({
      request: emit([{ id: 1, name: 'B' }, { id: 2, name: 'A' }]),
      items: [{ id: 1 }, { id: 2 }],
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'B' }, { id: 2, name: 'A' }]);
  });

  it('should emit onDelete', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForDelete().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{ id: 1, name: 'A' }])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.delete({
      request: emit(null),
      item: { id: 1 }
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1 }]);
  });

  it('should emit onItemsDelete', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };
    let lastEmitted: any = undefined;
    coll.listenForItemsDeletion([item]).subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.delete({
      request: emit(null),
      item: { id: 1 }
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1 }]);
  });

  it('should emit onDelete for deleteMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForDelete().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.deleteMany({
      request: emit(null),
      items: [{ id: 1 }, { id: 2 }]
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{ id: 1 }, { id: 2 }]);
  });

  it('should call first read handler', (done) => {
    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };
    const item3 = { id: 3, name: 'C' };

    jest.useRealTimers();

    const { coll } = setup();

    let handlerWasCalled = false;

    coll.setOnFirstItemsRequest(() => {
      handlerWasCalled = true;
      coll.read({
        request: of({ items: [item1, item2, item3] })
      }).subscribe();
    });

    expect(handlerWasCalled).toBeFalsy();
    const items = coll.$items();
    expect(items).toStrictEqual([]);

    setTimeout(() => {
      expect(handlerWasCalled).toBeTruthy();
      handlerWasCalled = false;
      const items = coll.$items();
      expect(handlerWasCalled).toBeFalsy();
      expect(items).toStrictEqual([item1, item2, item3]);
      done();
    }, 1);
  });

  it('should fetchItem', () => {
    const { coll } = setup();
    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };
    const item3 = { id: 3, name: 'C' };

    let unexpectedFetch = false;

    const service = {
      getItem: (id: number) => {
        if (id === 1) {
          return of(item1);
        } else if (id === 2) {
          unexpectedFetch = true;
          return of(item2);
        }
        return of(item3);
      }
    };

    coll.setOptions({ fetchItemRequestFactory: (item) => service.getItem(item.id) });

    let result;
    coll.fetchItem({ id: 1 }).subscribe((r) => result = r);
    jest.runAllTimers();
    expect(result).toStrictEqual(item1);

    coll.readOne({
      request: of(item2)
    }).subscribe();

    jest.runAllTimers();
    expect(coll.getItem({ id: 2 })()).toStrictEqual(item2);

    coll.fetchItem({ id: 2 }).subscribe((r) => result = r);
    expect(unexpectedFetch).toBeFalsy();
    expect(result).toStrictEqual(item2);

    coll.fetchItem({ id: 3 }, of(item3)).subscribe((r) => result = r);
    jest.runAllTimers();
    expect(result).toStrictEqual(item3);
  });

  it('should fill read error signal', () => {
    const { coll } = setup();

    coll.read({
      request: throwError(() => 4001),
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$lastReadError()?.errors).toEqual([4001]);

    coll.readMany({
      request: throwError(() => 4002)
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$lastReadManyError()?.errors).toEqual([4002]);

    coll.readOne({
      request: throwError(() => 4003)
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$lastReadOneError()?.errors).toEqual([4003]);

    coll.refresh({
      item: { id: 1 },
      request: throwError(() => 4004)
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$lastRefreshError()?.errors).toEqual([4004]);

    coll.refreshMany({
      items: [{ id: 1 }],
      request: throwError(() => 4005)
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$lastRefreshError()?.errors).toEqual([4005]);
  });

  it('should observe readFrom', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const source = new Subject<Item[]>();
    const isReading = signal(true);

    TestBed.runInInjectionContext(() => {
      const coll = new Collection<Item>({
        throwOnDuplicates: 'duplicate',
        comparatorFields: ['id'],
        readFrom: {
          source,
          isReading,
        }
      });

      expect(coll.$items()).toStrictEqual([]);
      expect(coll.$isReading()).toEqual(true);

      source.next([{ id: 1, name: 'A' }]);
      expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);
      isReading.set(false);
      expect(coll.$isReading()).toEqual(false);
    });
  });

  it('should observe readManyFrom', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const source = new Subject<Item[]>();
    const isReading = signal(false);

    TestBed.runInInjectionContext(() => {
      const coll = new Collection<Item>({
        throwOnDuplicates: 'duplicate',
        comparatorFields: ['id'],
        readManyFrom: {
          source,
          isReading,
        }
      });

      expect(coll.$items()).toStrictEqual([]);
      expect(coll.$isReading()).toEqual(false);

      source.next([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
      isReading.set(true);
      expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
      expect(coll.$isReading()).toEqual(true);
      isReading.set(false);
      expect(coll.$isReading()).toEqual(false);
    });
  });

  it('create should use the first emitted value only', () => {
    const { coll } = setup();
    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };

    coll.create({
      request: of(item1, item2)
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1]);
  });

  it('create should call onError and reset flags on error', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.create({
      request: throwError(() => 'boom'),
      onError,
    }).subscribe();

    expect(onError).toHaveBeenCalledWith('boom');
    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$isCreating()).toBe(false);
  });

  it('create should keep isCreating true until all concurrent creates complete', () => {
    const { coll } = setup();
    const item1 = { id: 1, name: 'first' };
    const item2 = { id: 2, name: 'second' };

    coll.create({
      request: timer(10).pipe(map(() => item1))
    }).subscribe();

    coll.create({
      request: timer(30).pipe(map(() => item2))
    }).subscribe();

    expect(coll.$isCreating()).toBe(true);
    expect(coll.$isSaving()).toBe(true);
    expect(coll.$isMutating()).toBe(true);
    expect(coll.$isProcessing()).toBe(true);

    jest.advanceTimersByTime(10);

    expect(coll.$items()).toStrictEqual([item1]);
    expect(coll.$isCreating()).toBe(true);
    expect(coll.$isSaving()).toBe(true);
    expect(coll.$isMutating()).toBe(true);
    expect(coll.$isProcessing()).toBe(true);

    jest.advanceTimersByTime(20);

    expect(coll.$items()).toStrictEqual([item1, item2]);
    expect(coll.$isCreating()).toBe(false);
    expect(coll.$isSaving()).toBe(false);
    expect(coll.$isMutating()).toBe(false);
    expect(coll.$isProcessing()).toBe(false);
  });

  it('createMany should keep input order and report errors', () => {
    const { coll } = setup();
    const itemSlow = { id: 1, name: 'slow' };
    const itemFast = { id: 2, name: 'fast' };
    let onErrorValue: unknown = undefined;

    coll.createMany({
      request: [
        timer(10).pipe(map(() => itemSlow)),
        throwError(() => 'err'),
        timer(1).pipe(map(() => itemFast)),
      ],
      onError: (e) => onErrorValue = e,
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(onErrorValue).toEqual(['err']);
    expect(coll.$items()).toStrictEqual([itemSlow, itemFast]);
  });

  it('read should keep isReading true until all concurrent reads complete', () => {
    const { coll } = setup();
    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };

    coll.read({
      request: timer(10).pipe(map(() => [item1])),
    }).subscribe();

    coll.read({
      request: timer(30).pipe(map(() => [item2])),
    }).subscribe();

    expect(coll.$isReading()).toBe(true);
    expect(coll.$isProcessing()).toBe(true);

    jest.advanceTimersByTime(10);

    expect(coll.$items()).toStrictEqual([item1]);
    expect(coll.$isReading()).toBe(true);
    expect(coll.$isProcessing()).toBe(true);

    jest.advanceTimersByTime(20);

    expect(coll.$items()).toStrictEqual([item2]);
    expect(coll.$isReading()).toBe(false);
    expect(coll.$isProcessing()).toBe(false);
  });

  it('update should keep isUpdating true until all concurrent updates for the same item complete', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };

    coll.read({
      request: of([item]),
    }).subscribe();

    coll.update({
      item,
      request: timer(10).pipe(map(() => ({ id: 1, name: 'B' }))),
    }).subscribe();

    coll.update({
      item,
      request: timer(30).pipe(map(() => ({ id: 1, name: 'C' }))),
    }).subscribe();

    expect(coll.$isUpdating()).toBe(true);
    expect(coll.$isSaving()).toBe(true);
    expect(coll.$isMutating()).toBe(true);
    expect(coll.$isProcessing()).toBe(true);

    jest.advanceTimersByTime(10);

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'B' }]);
    expect(coll.$isUpdating()).toBe(true);
    expect(coll.$isSaving()).toBe(true);
    expect(coll.$isMutating()).toBe(true);
    expect(coll.$isProcessing()).toBe(true);

    jest.advanceTimersByTime(20);

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'C' }]);
    expect(coll.$isUpdating()).toBe(false);
    expect(coll.$isSaving()).toBe(false);
    expect(coll.$isMutating()).toBe(false);
    expect(coll.$isProcessing()).toBe(false);
  });

  it('delete should keep isDeleting true until all concurrent deletes for the same item complete', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };

    coll.read({
      request: of([item]),
    }).subscribe();

    coll.delete({
      item,
      request: timer(10).pipe(map(() => null)),
    }).subscribe();

    coll.delete({
      item,
      request: timer(30).pipe(map(() => null)),
    }).subscribe();

    expect(coll.$isDeleting()).toBe(true);
    expect(coll.$isMutating()).toBe(true);
    expect(coll.$isProcessing()).toBe(true);
    expect(coll.$isSaving()).toBe(false);

    jest.advanceTimersByTime(10);

    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$isDeleting()).toBe(true);
    expect(coll.$isMutating()).toBe(true);
    expect(coll.$isProcessing()).toBe(true);
    expect(coll.$isSaving()).toBe(false);

    jest.advanceTimersByTime(20);

    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$isDeleting()).toBe(false);
    expect(coll.$isMutating()).toBe(false);
    expect(coll.$isProcessing()).toBe(false);
  });

  it('refresh should keep refreshingItems until all concurrent refreshes for the same item complete', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };

    coll.read({
      request: of([item]),
    }).subscribe();

    coll.refresh({
      item,
      request: timer(10).pipe(map(() => ({ id: 1, name: 'B' }))),
    }).subscribe();

    coll.refresh({
      item,
      request: timer(30).pipe(map(() => ({ id: 1, name: 'C' }))),
    }).subscribe();

    expect(coll.$refreshingItems()).toStrictEqual([item]);
    expect(coll.$isProcessing()).toBe(true);

    jest.advanceTimersByTime(10);

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'B' }]);
    expect(coll.$refreshingItems()).toStrictEqual([item]);
    expect(coll.$isProcessing()).toBe(true);

    jest.advanceTimersByTime(20);

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'C' }]);
    expect(coll.$refreshingItems()).toStrictEqual([]);
    expect(coll.$isProcessing()).toBe(false);
  });

  it('read should keep items when keepExistingOnError is true', () => {
    const { coll } = setup();
    const initial = [{ id: 1, name: 'A' }];

    coll.read({
      request: of({ items: initial, totalCount: 5 }),
    }).subscribe();

    expect(coll.$items()).toStrictEqual(initial);
    expect(coll.$totalCountFetched()).toStrictEqual(5);

    coll.read({
      request: throwError(() => 'boom'),
      keepExistingOnError: true,
      context: 'ctx',
      items: [{ id: 1 }],
    }).subscribe();

    expect(coll.$items()).toStrictEqual(initial);
    expect(coll.$totalCountFetched()).toStrictEqual(5);
    expect(coll.$lastReadError()?.errors).toEqual(['boom']);
  });

  it('read should report duplicates when allowFetchedDuplicates is true', () => {
    const errReporter = jest.fn();
    const coll = new Collection<Item>({
      comparatorFields: ['id'],
      errReporter,
    });

    coll.read({
      request: of([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]);
    expect(errReporter).toHaveBeenCalled();
  });

  it('readMany should report partial errors and set lastReadManyError', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };
    let onErrorValue: unknown = undefined;

    coll.readMany({
      request: [emit(item), throwError(() => 'err')],
      onError: (e) => onErrorValue = e,
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(onErrorValue).toEqual(['err']);
    expect(coll.$items()).toStrictEqual([item]);
    expect(coll.$lastReadManyError()?.errors).toEqual(['err']);
  });

  it('refresh should clear refreshingItems on error', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };

    coll.read({
      request: of([item]),
    }).subscribe();

    coll.refresh({
      item,
      request: timer(1).pipe(switchMap(() => throwError(() => 'boom'))),
    }).subscribe();

    expect(coll.$refreshingItems()).toStrictEqual([item]);
    jest.runOnlyPendingTimers();

    expect(coll.$refreshingItems()).toStrictEqual([]);
    expect(coll.$lastRefreshError()?.errors).toEqual(['boom']);
    expect(coll.$isProcessing()).toBe(false);
  });

  it('update should use refreshRequest result and still run request', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };
    let requestCalls = 0;
    let onSuccessValue: Item | undefined = undefined;

    coll.read({
      request: of([item]),
    }).subscribe();

    coll.update({
      item,
      request: defer(() => {
        requestCalls++;
        return emit({ id: 1, name: 'B' });
      }),
      refreshRequest: emit({ id: 1, name: 'C' }),
      onSuccess: (v) => onSuccessValue = v,
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item]);
    expect(coll.$updatingItems()).toStrictEqual([item]);

    jest.runAllTimers();

    expect(requestCalls).toBe(1);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'C' }]);
    expect(onSuccessValue).toStrictEqual({ id: 1, name: 'C' });
  });

  it('updateMany should use refresh results and still run request', () => {
    const { coll } = setup();
    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };
    let requestCalls = 0;

    coll.read({
      request: of([item1, item2]),
    }).subscribe();

    coll.updateMany({
      items: [item1, item2],
      request: defer(() => {
        requestCalls++;
        return emit([{ id: 1, name: 'A1' }, { id: 2, name: 'B1' }]);
      }),
      refresh: {
        items: [item1, item2],
        request: emit([{ id: 1, name: 'A2' }, { id: 2, name: 'B2' }]),
      },
    }).subscribe();

    expect(coll.$updatingItems()).toStrictEqual([item1, item2]);
    jest.runAllTimers();

    expect(requestCalls).toBe(1);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A2' }, { id: 2, name: 'B2' }]);
  });

  it('delete should use readRequest and ignore decrementTotalCount', () => {
    const { coll } = setup();
    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };

    coll.read({
      request: of({ items: [item1, item2], totalCount: 2 }),
    }).subscribe();

    coll.delete({
      item: item1,
      request: emit(null),
      decrementTotalCount: true,
      readRequest: emit({ items: [item2], totalCount: 10 }),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2]);
    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([item2]);
    expect(coll.$totalCountFetched()).toStrictEqual(10);
  });

  it('deleteMany should use read and ignore decrementTotalCount', () => {
    const { coll } = setup();
    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };
    const item3 = { id: 3, name: 'C' };

    coll.read({
      request: of({ items: [item1, item2, item3], totalCount: 3 }),
    }).subscribe();

    coll.deleteMany({
      items: [item1, item2],
      request: emit(null),
      decrementTotalCount: 2,
      read: {
        request: emit({ items: [item3], totalCount: 99 }),
      },
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([item3]);
    expect(coll.$totalCountFetched()).toStrictEqual(99);
  });

  it('delete should ignore invalid decrementTotalCount string', () => {
    const { coll } = setup();
    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };

    coll.read({
      request: of({ items: [item1, item2], totalCount: 5 }),
    }).subscribe();

    coll.delete({
      item: item1,
      request: of({ total: -1 }),
      decrementTotalCount: 'missing',
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item2]);
    expect(coll.$totalCountFetched()).toStrictEqual(5);
  });

  it('fetchItem should error when no request is provided', (done) => {
    const errReporter = jest.fn();
    const coll = new Collection<Item>({
      comparatorFields: ['id'],
      errReporter,
    });

    coll.fetchItem({ id: 1 }).subscribe({
      next: () => done.fail('Expected error'),
      error: (err) => {
        expect(err).toBe(404);
        expect(errReporter).toHaveBeenCalledWith('Fetching request is not provided to fetchItem');
        done();
      },
    });
  });

  it('readFrom should call onError when source errors', () => {
    const { coll } = setup();
    const source = new Subject<Item[]>();
    const onError = jest.fn();

    coll.readFrom({
      source,
      onError,
    }).subscribe();

    source.error('boom');

    expect(onError).toHaveBeenCalledWith('boom');
  });

  it('should reflect completion order for overlapping create calls', () => {
    const { coll } = setup();
    const first = { id: 1, name: 'first' };
    const second = { id: 2, name: 'second' };

    coll.create({
      request: timer(10).pipe(map(() => first)),
    }).subscribe();

    coll.create({
      request: timer(1).pipe(map(() => second)),
    }).subscribe();

    jest.advanceTimersByTime(1);
    expect(coll.$items()).toStrictEqual([second]);

    jest.advanceTimersByTime(9);
    expect(coll.$items()).toStrictEqual([second, first]);
  });

  it('create should call onSuccess with the created item', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };
    const onSuccess = jest.fn();

    coll.create({
      request: emit(item),
      onSuccess,
    }).subscribe();

    expect(onSuccess).not.toHaveBeenCalled();
    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith(item);
    expect(coll.$items()).toStrictEqual([item]);
  });

  it('create should call onError with onDuplicateErrCallbackParam when duplicate detected (no throw)', () => {
    const coll = new Collection<Item>({
      comparatorFields: ['id'],
      throwOnDuplicates: false,
    });
    const item = { id: 1, name: 'A' };
    const onError = jest.fn();

    coll.create({ request: of(item) }).subscribe();
    expect(coll.$items()).toStrictEqual([item]);

    coll.create({
      request: emit(item),
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].name).toBe('DuplicateError');
    expect(coll.$items()).toStrictEqual([item]);
    expect(coll.$isCreating()).toBe(false);
  });

  it('create should call onError with thrown Error when throwOnDuplicates is set and duplicate detected', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };
    const onError = jest.fn();

    coll.create({ request: of(item) }).subscribe();

    coll.create({
      request: emit(item),
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onError).toHaveBeenCalledTimes(1);
    const errorArg = onError.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe('duplicate');
    expect(coll.$items()).toStrictEqual([item]);
    expect(coll.$isCreating()).toBe(false);
  });

  it('create should not call any callback when request emits null', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();
    const onError = jest.fn();

    coll.create({
      request: emit(null as any),
      onSuccess,
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$isCreating()).toBe(false);
  });

  it('create should handle race condition: two concurrent creates for the same item', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };
    const onSuccessSlow = jest.fn();
    const onErrorSlow = jest.fn();
    const onSuccessFast = jest.fn();
    const onErrorFast = jest.fn();

    coll.create({
      request: timer(30).pipe(map(() => item)),
      onSuccess: onSuccessSlow,
      onError: onErrorSlow,
    }).subscribe();

    coll.create({
      request: timer(10).pipe(map(() => item)),
      onSuccess: onSuccessFast,
      onError: onErrorFast,
    }).subscribe();

    expect(coll.$isCreating()).toBe(true);

    jest.advanceTimersByTime(10);

    expect(onSuccessFast).toHaveBeenCalledWith(item);
    expect(onErrorFast).not.toHaveBeenCalled();
    expect(coll.$items()).toStrictEqual([item]);
    expect(coll.$isCreating()).toBe(true);

    jest.advanceTimersByTime(20);

    expect(onSuccessSlow).not.toHaveBeenCalled();
    expect(onErrorSlow).toHaveBeenCalledTimes(1);
    expect(coll.$items()).toStrictEqual([item]);
    expect(coll.$isCreating()).toBe(false);
  });

  it('createMany should call onSuccess with fetched items', () => {
    const { coll } = setup();
    const items = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    const onSuccess = jest.fn();

    coll.createMany({
      request: emit(items),
      onSuccess,
    }).subscribe();

    expect(onSuccess).not.toHaveBeenCalled();
    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith(items);
    expect(coll.$items()).toStrictEqual(items);
  });

  it('createMany should call onError when entire request fails', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.createMany({
      request: throwError(() => 'total failure'),
      onError,
    }).subscribe();

    expect(onError).toHaveBeenCalledWith('total failure');
    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$isCreating()).toBe(false);
  });

  it('createMany should upsert items that already exist in the collection', () => {
    const { coll } = setup();
    const existing = { id: 1, name: 'old' };
    const updated = { id: 1, name: 'new' };
    const brandNew = { id: 2, name: 'B' };
    const onSuccess = jest.fn();

    coll.read({ request: of([existing]) }).subscribe();
    expect(coll.$items()).toStrictEqual([existing]);

    coll.createMany({
      request: emit([updated, brandNew]),
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith([updated, brandNew]);
    expect(coll.$items()).toStrictEqual([updated, brandNew]);
  });

  it('createMany should call onError with onDuplicateErrCallbackParam for duplicates within fetched items (no throw)', () => {
    const errReporter = jest.fn();
    const coll = new Collection<Item>({
      comparatorFields: ['id'],
      errReporter,
      throwOnDuplicates: false,
    });
    const existing = { id: 1, name: 'A' };
    const onError = jest.fn();

    coll.read({ request: of([existing]) }).subscribe();

    coll.createMany({
      request: emit([{ id: 2, name: 'B' }, { id: 2, name: 'C' }]),
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].name).toBe('DuplicateError');
    expect(coll.$items()).toStrictEqual([existing]);
    expect(coll.$isCreating()).toBe(false);
  });

  it('createMany errReporter should receive the fetched items when duplicates are within the fetched set (preExisting bug)', () => {
    const errReporter = jest.fn();
    const coll = new Collection<Item>({
      comparatorFields: ['id'],
      errReporter,
      throwOnDuplicates: false,
    });
    const existing = { id: 1, name: 'A' };
    const fetchedWithDupes = [{ id: 2, name: 'B' }, { id: 2, name: 'C' }];

    coll.read({ request: of([existing]) }).subscribe();
    errReporter.mockClear();

    coll.createMany({
      request: emit(fetchedWithDupes),
    }).subscribe();

    jest.runAllTimers();

    expect(errReporter).toHaveBeenCalled();
    const firstCallArgs = errReporter.mock.calls[0];
    // errReporter should be called with the fetched items (that contain duplicates),
    // not the existing collection items.
    // BUG: upsertMany never sets preExisting=true, so duplicateNotAdded
    // receives the existing collection items instead of the fetched items.
    expect(firstCallArgs[2]).toStrictEqual(fetchedWithDupes);
  });

  it('createMany should keep isCreating true for concurrent createMany calls', () => {
    const { coll } = setup();

    coll.createMany({
      request: timer(30).pipe(map(() => [{ id: 1, name: 'A' }])),
    }).subscribe();

    coll.createMany({
      request: timer(10).pipe(map(() => [{ id: 2, name: 'B' }])),
    }).subscribe();

    expect(coll.$isCreating()).toBe(true);

    jest.advanceTimersByTime(10);

    expect(coll.$items()).toStrictEqual([{ id: 2, name: 'B' }]);
    expect(coll.$isCreating()).toBe(true);

    jest.advanceTimersByTime(20);

    expect(coll.$items()).toStrictEqual([{ id: 2, name: 'B' }, { id: 1, name: 'A' }]);
    expect(coll.$isCreating()).toBe(false);
  });

  it('read should call onSuccess with the items array', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({
      request: emit([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]),
      onSuccess,
    }).subscribe();

    expect(onSuccess).not.toHaveBeenCalled();
    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  });

  it('read should call onSuccess with items array (not FetchedItems) for FetchedItems response', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({
      request: emit({ items: [{ id: 1, name: 'A' }], totalCount: 42 }),
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith([{ id: 1, name: 'A' }]);
    expect(coll.$totalCountFetched()).toBe(42);
  });

  it('read should call onError callback on request error', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.read({
      request: throwError(() => 'read-failed'),
      onError,
    }).subscribe();

    expect(onError).toHaveBeenCalledWith('read-failed');
  });

  it('read lastReadError should include context and items', () => {
    const { coll } = setup();

    coll.read({
      request: throwError(() => 'err'),
      context: { page: 3 },
      items: [{ id: 1 } as Item, { id: 2 } as Item],
    }).subscribe();

    const lastErr = coll.$lastReadError();
    expect(lastErr).toBeDefined();
    expect(lastErr!.errors).toEqual(['err']);
    expect(lastErr!.context).toEqual({ page: 3 });
    expect(lastErr!.items).toStrictEqual([{ id: 1 }, { id: 2 }]);
    expect(lastErr!.time).toBeInstanceOf(Date);
  });

  it('read should set isBeforeFirstRead to false even on error', () => {
    const { coll } = setup();

    expect(coll.$isBeforeFirstRead()).toBe(true);

    coll.read({
      request: timer(10).pipe(switchMap(() => throwError(() => 'err'))),
    }).subscribe();

    expect(coll.$isBeforeFirstRead()).toBe(true);
    expect(coll.$isReading()).toBe(true);

    jest.runAllTimers();

    expect(coll.$isBeforeFirstRead()).toBe(false);
    expect(coll.$isReading()).toBe(false);
  });

  it('read should clear lastReadError on new read attempt', () => {
    const { coll } = setup();

    coll.read({
      request: throwError(() => 'first-err'),
    }).subscribe();

    expect(coll.$lastReadError()).toBeDefined();

    coll.read({
      request: emit([{ id: 1, name: 'A' }]),
    }).subscribe();

    expect(coll.$lastReadError()).toBeUndefined();
    jest.runAllTimers();
    expect(coll.$lastReadError()).toBeUndefined();
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('read should overwrite items from an in-flight update', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };

    coll.read({ request: of([item]) }).subscribe();

    coll.update({
      item,
      request: timer(5).pipe(map(() => ({ id: 1, name: 'updated' }))),
    }).subscribe();

    expect(coll.$isUpdating()).toBe(true);

    coll.read({
      request: timer(10).pipe(map(() => [{ id: 1, name: 'from-read' }])),
    }).subscribe();

    jest.advanceTimersByTime(5);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'updated' }]);

    jest.advanceTimersByTime(5);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'from-read' }]);
  });

  it('read with empty array should clear existing items and unset totalCount', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({
      request: of({ items: [{ id: 1, name: 'A' }], totalCount: 10 }),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);
    expect(coll.$totalCountFetched()).toBe(10);

    coll.read({
      request: emit([]),
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$totalCountFetched()).toBeUndefined();
    expect(onSuccess).toHaveBeenCalledWith([]);
  });

  it('read should handle null response gracefully without triggering error path (totalCount null-safety bug test)', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.read({
      request: of({ items: [{ id: 1, name: 'A' }], totalCount: 5 }),
    }).subscribe();
    expect(coll.$totalCountFetched()).toBe(5);

    coll.read({
      request: emit(null as any),
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$totalCountFetched()).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
    expect(coll.$lastReadError()).toBeUndefined();
  });

  it('readOne should call onSuccess with the item', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.readOne({
      request: emit({ id: 1, name: 'A' }),
      onSuccess,
    }).subscribe();

    expect(onSuccess).not.toHaveBeenCalled();
    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith({ id: 1, name: 'A' });
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('readOne should call onError callback on request error', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.readOne({
      request: throwError(() => 'readone-failed'),
      onError,
      item: { id: 1 } as Item,
      context: 'detail-page',
    }).subscribe();

    expect(onError).toHaveBeenCalledWith('readone-failed');
    const lastErr = coll.$lastReadOneError();
    expect(lastErr).toBeDefined();
    expect(lastErr!.errors).toEqual(['readone-failed']);
    expect(lastErr!.items).toStrictEqual([{ id: 1 }]);
    expect(lastErr!.context).toBe('detail-page');
  });

  it('readOne should set isBeforeFirstRead to false even on error', () => {
    const { coll } = setup();

    expect(coll.$isBeforeFirstRead()).toBe(true);

    coll.readOne({
      request: timer(10).pipe(switchMap(() => throwError(() => 'err'))),
    }).subscribe();

    expect(coll.$isBeforeFirstRead()).toBe(true);
    jest.runAllTimers();
    expect(coll.$isBeforeFirstRead()).toBe(false);
  });

  it('readOne should not call any callback when request emits null', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();
    const onError = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.readOne({
      request: emit(null as any),
      onSuccess,
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('readOne should clear lastReadOneError on new attempt', () => {
    const { coll } = setup();

    coll.readOne({
      request: throwError(() => 'err'),
    }).subscribe();
    expect(coll.$lastReadOneError()).toBeDefined();

    coll.readOne({
      request: emit({ id: 1, name: 'A' }),
    }).subscribe();
    expect(coll.$lastReadOneError()).toBeUndefined();

    jest.runAllTimers();
    expect(coll.$lastReadOneError()).toBeUndefined();
  });

  it('readOne should handle concurrent readOne for same and different items', () => {
    const { coll } = setup();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.readOne({
      request: timer(30).pipe(map(() => ({ id: 1, name: 'slow' }))),
      item: { id: 1 } as Item,
    }).subscribe();

    coll.readOne({
      request: timer(10).pipe(map(() => ({ id: 2, name: 'fast' }))),
      item: { id: 2 } as Item,
    }).subscribe();

    expect(coll.$isReading()).toBe(true);
    expect(coll.$readingItems()).toStrictEqual([{ id: 1 }, { id: 2 }]);

    jest.advanceTimersByTime(10);

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'fast' }]);
    expect(coll.$isReading()).toBe(true);
    expect(coll.$readingItems()).toStrictEqual([{ id: 1 }]);

    jest.advanceTimersByTime(20);

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'slow' }, { id: 2, name: 'fast' }]);
    expect(coll.$isReading()).toBe(false);
    expect(coll.$readingItems()).toStrictEqual([]);
  });

  it('readOne should call onError when collection has pre-existing duplicates and upsertOne returns duplicate', () => {
    const errReporter = jest.fn();
    const coll = new Collection<Item>({
      comparatorFields: ['id'],
      allowFetchedDuplicates: true,
      errReporter,
    });

    coll.read({
      request: of([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]),
    }).subscribe();
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]);
    errReporter.mockClear();

    const onError = jest.fn();
    coll.readOne({
      request: emit({ id: 1, name: 'C' }),
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]);
  });

  it('readMany should call onSuccess with the full items array (existing + new)', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.readMany({
      request: emit([{ id: 2, name: 'B' }]),
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  });

  it('readMany should call onError on total request failure', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.readMany({
      request: throwError(() => 'total-failure'),
      onError,
      items: [{ id: 1 } as Item],
      context: 'page-2',
    }).subscribe();

    expect(onError).toHaveBeenCalledWith('total-failure');
    const lastErr = coll.$lastReadManyError();
    expect(lastErr).toBeDefined();
    expect(lastErr!.errors).toEqual(['total-failure']);
    expect(lastErr!.items).toStrictEqual([{ id: 1 }]);
    expect(lastErr!.context).toBe('page-2');
  });

  it('readMany should set isBeforeFirstRead to false even on error', () => {
    const { coll } = setup();

    expect(coll.$isBeforeFirstRead()).toBe(true);

    coll.readMany({
      request: timer(10).pipe(switchMap(() => throwError(() => 'err'))),
    }).subscribe();

    expect(coll.$isBeforeFirstRead()).toBe(true);
    jest.runAllTimers();
    expect(coll.$isBeforeFirstRead()).toBe(false);
  });

  it('readMany should clear lastReadManyError on new attempt', () => {
    const { coll } = setup();

    coll.readMany({
      request: throwError(() => 'err'),
    }).subscribe();
    expect(coll.$lastReadManyError()).toBeDefined();

    coll.readMany({
      request: emit([{ id: 1, name: 'A' }]),
    }).subscribe();
    expect(coll.$lastReadManyError()).toBeUndefined();

    jest.runAllTimers();
    expect(coll.$lastReadManyError()).toBeUndefined();
  });

  it('readMany should upsert items that already exist in the collection', () => {
    const { coll } = setup();

    coll.read({ request: of([{ id: 1, name: 'old' }, { id: 2, name: 'B' }]) }).subscribe();

    coll.readMany({
      request: emit([{ id: 1, name: 'new' }, { id: 3, name: 'C' }]),
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([
      { id: 1, name: 'new' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);
  });

  it('readMany should not crash when single request emits null (totalCount null-safety bug test)', () => {
    const { coll } = setup();

    coll.read({ request: of({ items: [{ id: 1, name: 'A' }], totalCount: 10 }) }).subscribe();
    expect(coll.$totalCountFetched()).toBe(10);

    coll.readMany({
      request: emit(null as any),
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$totalCountFetched()).toBeUndefined();
  });

  it('readMany should set lastReadManyError for partial forkJoin errors even without onError callback (bug test)', () => {
    const { coll } = setup();

    coll.readMany({
      request: [emit({ id: 1, name: 'A' }), throwError(() => 'partial-err')],
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$lastReadManyError()).toBeDefined();
    expect(coll.$lastReadManyError()!.errors).toEqual(['partial-err']);
  });

  it('readFrom should replace items on each new source emission (switchMap behavior)', () => {
    const { coll } = setup();
    const source = new Subject<Item[]>();

    coll.readFrom({ source }).subscribe();

    source.next([{ id: 1, name: 'A' }]);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);

    source.next([{ id: 2, name: 'B' }]);
    expect(coll.$items()).toStrictEqual([{ id: 2, name: 'B' }]);

    source.next([{ id: 3, name: 'C' }, { id: 4, name: 'D' }]);
    expect(coll.$items()).toStrictEqual([{ id: 3, name: 'C' }, { id: 4, name: 'D' }]);
  });

  it('readFrom should pass onSuccess through to inner read', () => {
    const { coll } = setup();
    const source = new Subject<Item[]>();
    const onSuccess = jest.fn();

    coll.readFrom({ source, onSuccess }).subscribe();

    source.next([{ id: 1, name: 'A' }]);
    expect(onSuccess).toHaveBeenCalledWith([{ id: 1, name: 'A' }]);
  });

  it('readManyFrom should call onError when source errors', () => {
    const { coll } = setup();
    const source = new Subject<Item[]>();
    const onError = jest.fn();

    coll.readManyFrom({ source, onError }).subscribe();

    source.error('source-boom');
    expect(onError).toHaveBeenCalledWith('source-boom');
  });

  it('readManyFrom should accumulate items across emissions', () => {
    const { coll } = setup();
    const source = new Subject<Item[]>();

    coll.readManyFrom({ source }).subscribe();

    source.next([{ id: 1, name: 'A' }]);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);

    source.next([{ id: 2, name: 'B' }]);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);

    source.next([{ id: 1, name: 'A-updated' }, { id: 3, name: 'C' }]);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A-updated' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]);
  });

  it('readManyFrom should pass onSuccess through to inner readMany', () => {
    const { coll } = setup();
    const source = new Subject<Item[]>();
    const onSuccess = jest.fn();

    coll.readManyFrom({ source, onSuccess }).subscribe();

    source.next([{ id: 1, name: 'A' }]);
    expect(onSuccess).toHaveBeenCalledWith([{ id: 1, name: 'A' }]);
  });

  it('refresh should call onSuccess with the refreshed item', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };
    const onSuccess = jest.fn();

    coll.read({ request: of([item]) }).subscribe();

    coll.refresh({
      request: emit({ id: 1, name: 'refreshed' }),
      item,
      onSuccess,
    }).subscribe();

    expect(onSuccess).not.toHaveBeenCalled();
    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith({ id: 1, name: 'refreshed' });
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'refreshed' }]);
  });

  it('refresh should call onError and set lastRefreshError with context on request error', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };
    const onError = jest.fn();

    coll.read({ request: of([item]) }).subscribe();

    coll.refresh({
      request: timer(5).pipe(switchMap(() => throwError(() => 'refresh-fail'))),
      item,
      onError,
      context: 'detail-view',
    }).subscribe();

    expect(coll.$refreshingItems()).toStrictEqual([item]);
    jest.runAllTimers();

    expect(onError).toHaveBeenCalledWith('refresh-fail');
    expect(coll.$refreshingItems()).toStrictEqual([]);
    const lastErr = coll.$lastRefreshError();
    expect(lastErr!.errors).toEqual(['refresh-fail']);
    expect(lastErr!.items).toStrictEqual([item]);
    expect(lastErr!.context).toBe('detail-view');
  });

  it('refresh should clear lastRefreshError on new attempt', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };

    coll.read({ request: of([item]) }).subscribe();

    coll.refresh({
      request: throwError(() => 'err'),
      item,
    }).subscribe();
    expect(coll.$lastRefreshError()).toBeDefined();

    coll.refresh({
      request: emit({ id: 1, name: 'ok' }),
      item,
    }).subscribe();
    expect(coll.$lastRefreshError()).toBeUndefined();

    jest.runAllTimers();
    expect(coll.$lastRefreshError()).toBeUndefined();
  });

  it('refresh should not call any callback when request emits null', () => {
    const { coll } = setup();
    const item = { id: 1, name: 'A' };
    const onSuccess = jest.fn();
    const onError = jest.fn();

    coll.read({ request: of([item]) }).subscribe();

    coll.refresh({
      request: emit(null as any),
      item,
      onSuccess,
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(coll.$items()).toStrictEqual([item]);
  });

  it('refresh should add a new item if it does not exist in the collection', () => {
    const { coll } = setup();
    const existing = { id: 1, name: 'A' };
    const newItem = { id: 2, name: 'B' };

    coll.read({ request: of([existing]) }).subscribe();

    coll.refresh({
      request: emit(newItem),
      item: newItem,
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([existing, newItem]);
  });

  it('refreshMany should call onSuccess with the full items array', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]) }).subscribe();

    coll.refreshMany({
      request: emit([{ id: 1, name: 'A2' }]),
      items: [{ id: 1 } as Item],
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith([{ id: 1, name: 'A2' }, { id: 2, name: 'B' }]);
  });

  it('refreshMany should call onError and set lastRefreshError on total request failure', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.refreshMany({
      request: throwError(() => 'refresh-many-fail'),
      items: [{ id: 1 } as Item],
      onError,
      context: 'bulk-refresh',
    }).subscribe();

    expect(onError).toHaveBeenCalledWith('refresh-many-fail');
    const lastErr = coll.$lastRefreshError();
    expect(lastErr!.errors).toEqual(['refresh-many-fail']);
    expect(lastErr!.items).toStrictEqual([{ id: 1 }]);
    expect(lastErr!.context).toBe('bulk-refresh');
  });

  it('refreshMany should clear lastRefreshError on new attempt', () => {
    const { coll } = setup();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.refreshMany({
      request: throwError(() => 'err'),
      items: [{ id: 1 } as Item],
    }).subscribe();
    expect(coll.$lastRefreshError()).toBeDefined();

    coll.refreshMany({
      request: emit([{ id: 1, name: 'A2' }]),
      items: [{ id: 1 } as Item],
    }).subscribe();
    expect(coll.$lastRefreshError()).toBeUndefined();

    jest.runAllTimers();
    expect(coll.$lastRefreshError()).toBeUndefined();
  });

  it('refreshMany should set lastRefreshError for partial forkJoinSafe errors even without onError callback (bug test)', () => {
    const { coll } = setup();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.refreshMany({
      request: [emit({ id: 1, name: 'A-refreshed' }), throwError(() => 'partial-refresh-err')],
      items: [{ id: 1 } as Item, { id: 2 } as Item],
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A-refreshed' }]);
    expect(coll.$lastRefreshError()).toBeDefined();
    expect(coll.$lastRefreshError()!.errors).toEqual(['partial-refresh-err']);
  });

  it('update should call onSuccess with the updated item (direct upsert path)', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.update({
      request: emit({ id: 1, name: 'updated' }),
      item: { id: 1 } as Item,
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith({ id: 1, name: 'updated' });
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'updated' }]);
  });

  it('update should call onError on request error', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.update({
      request: throwError(() => 'update-fail'),
      item: { id: 1 } as Item,
      onError,
    }).subscribe();

    expect(onError).toHaveBeenCalledWith('update-fail');
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('update should not call any callback when request emits null', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();
    const onError = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.update({
      request: emit(null as any),
      item: { id: 1 } as Item,
      onSuccess,
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('update should call onError with onDuplicateErrCallbackParam when upsert detects duplicate', () => {
    const onError = jest.fn();
    const coll = new Collection<Item>({
      comparatorFields: ['id'],
      allowFetchedDuplicates: true,
    });

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]) }).subscribe();
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]);

    coll.update({
      request: emit({ id: 1, name: 'C' }),
      item: { id: 1, name: 'A' },
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]);
  });

  it('updateMany should call onSuccess with updated items (direct upsert path)', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]) }).subscribe();

    coll.updateMany({
      request: emit([{ id: 1, name: 'A2' }, { id: 2, name: 'B2' }]),
      items: [{ id: 1 } as Item, { id: 2 } as Item],
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith([{ id: 1, name: 'A2' }, { id: 2, name: 'B2' }]);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A2' }, { id: 2, name: 'B2' }]);
  });

  it('updateMany should call onError on total request failure', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.updateMany({
      request: throwError(() => 'updateMany-fail'),
      items: [{ id: 1 } as Item],
      onError,
    }).subscribe();

    expect(onError).toHaveBeenCalledWith('updateMany-fail');
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('updateMany should report partial forkJoinSafe errors via onError', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]) }).subscribe();

    coll.updateMany({
      request: [emit({ id: 1, name: 'A2' }), throwError(() => 'partial-update-err')],
      items: [{ id: 1 } as Item, { id: 2 } as Item],
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onError).toHaveBeenCalledWith(['partial-update-err']);
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A2' }, { id: 2, name: 'B' }]);
  });

  it('updateMany should not call onError for partial errors when no onError callback provided', () => {
    const { coll } = setup();

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]) }).subscribe();

    let completed = false;
    coll.updateMany({
      request: [emit({ id: 1, name: 'A2' }), throwError(() => 'silent-err')],
      items: [{ id: 1 } as Item, { id: 2 } as Item],
    }).subscribe({ complete: () => completed = true });

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A2' }, { id: 2, name: 'B' }]);
    expect(completed).toBe(true);
  });

  it('updateMany with empty items should return EMPTY and call onError', () => {
    const { coll } = setup();
    const onError = jest.fn();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    let next = false;
    coll.updateMany({
      request: emit([{ id: 1, name: 'A' }]),
      items: [],
      onError,
    }).subscribe({ next: () => next = true });

    jest.runAllTimers();

    expect(next).toBe(false);
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    spy.mockRestore();
  });

  it('delete should call onSuccess with the response and remove the item (direct path)', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]) }).subscribe();

    coll.delete({
      request: emit('deleted'),
      item: { id: 1 } as Item,
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalledWith('deleted');
    expect(coll.$items()).toStrictEqual([{ id: 2, name: 'B' }]);
  });

  it('delete should call onError on request error and keep items', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.delete({
      request: throwError(() => 'delete-fail'),
      item: { id: 1 } as Item,
      onError,
    }).subscribe();

    expect(onError).toHaveBeenCalledWith('delete-fail');
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('delete without request should remove item immediately with null response', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]) }).subscribe();

    coll.delete({
      item: { id: 1 } as Item,
      onSuccess,
    }).subscribe();

    expect(onSuccess).toHaveBeenCalledWith(null);
    expect(coll.$items()).toStrictEqual([{ id: 2, name: 'B' }]);
  });

  it('delete with decrementTotalCount true should decrement by 1', () => {
    const { coll } = setup();

    coll.read({ request: of({ items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], totalCount: 10 }) }).subscribe();
    expect(coll.$totalCountFetched()).toBe(10);

    coll.delete({
      request: emit('ok'),
      item: { id: 1 } as Item,
      decrementTotalCount: true,
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([{ id: 2, name: 'B' }]);
    expect(coll.$totalCountFetched()).toBe(9);
  });

  it('delete with decrementTotalCount number should decrement by that number', () => {
    const { coll } = setup();

    coll.read({ request: of({ items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], totalCount: 10 }) }).subscribe();

    coll.delete({
      request: emit('ok'),
      item: { id: 1 } as Item,
      decrementTotalCount: 3,
    }).subscribe();

    jest.runAllTimers();

    expect(coll.$items()).toStrictEqual([{ id: 2, name: 'B' }]);
    expect(coll.$totalCountFetched()).toBe(7);
  });

  it('deleteMany should call onSuccess with the response and remove items (direct path)', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]) }).subscribe();

    coll.deleteMany({
      request: [emit('r1'), emit('r2')],
      items: [{ id: 1 } as Item, { id: 2 } as Item],
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalled();
    expect(coll.$items()).toStrictEqual([{ id: 3, name: 'C' }]);
  });

  it('deleteMany should call onError on total request failure', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }]) }).subscribe();

    coll.deleteMany({
      request: [throwError(() => 'delete-many-fail')],
      items: [{ id: 1 } as Item],
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onError).toHaveBeenCalledWith(['delete-many-fail']);
  });

  it('deleteMany should report partial forkJoinSafe errors via onError', () => {
    const { coll } = setup();
    const onError = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]) }).subscribe();

    coll.deleteMany({
      request: [emit('ok'), throwError(() => 'partial-delete-err')],
      items: [{ id: 1 } as Item, { id: 2 } as Item],
      onError,
    }).subscribe();

    jest.runAllTimers();

    expect(onError).toHaveBeenCalledWith(['partial-delete-err']);
  });

  it('deleteMany with empty items should return EMPTY and call onError', () => {
    const { coll } = setup();
    const onError = jest.fn();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    let next = false;
    coll.deleteMany({
      request: [emit('ok')],
      items: [],
      onError,
    }).subscribe({ next: () => next = true });

    jest.runAllTimers();

    expect(next).toBe(false);
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    spy.mockRestore();
  });

  it('deleteMany without request should remove items with null response', () => {
    const { coll } = setup();
    const onSuccess = jest.fn();

    coll.read({ request: of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]) }).subscribe();

    coll.deleteMany({
      items: [{ id: 1 } as Item, { id: 2 } as Item],
      onSuccess,
    }).subscribe();

    jest.runAllTimers();

    expect(onSuccess).toHaveBeenCalled();
    expect(coll.$items()).toStrictEqual([{ id: 3, name: 'C' }]);
  });
});
