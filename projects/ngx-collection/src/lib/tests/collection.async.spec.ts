import { map, of, timer } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { Collection, NGX_COLLECTION_OPTIONS } from '../collection';

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
  const injector = createEnvironmentInjector([
    {
      provide: NGX_COLLECTION_OPTIONS,
      useValue: {throwOnDuplicates: 'duplicate', comparatorFields: ['id']}
    },
    {
      provide: Collection,
      useClass: Collection,
    }
  ], TestBed.inject(EnvironmentInjector));
  const coll = injector.get(Collection<Item>);

  return {
    coll,
  };
}

function emit<T>(result: T) {
  return timer(1).pipe(map(() => result));
}

describe('Collection Service (Signal-based, async)', () => {
  it('create', () => {
    const {coll} = setup();
    const newItem: Item = {id: 0, name: ':)'};

    expect(coll.isCreating()).toBe(false);
    expect(coll.isProcessing()).toBe(false);
    expect(coll.isMutating()).toBe(false);

    coll.create({
      request: emit(newItem)
    }).subscribe();

    expect(coll.isCreating()).toBe(true);
    expect(coll.isProcessing()).toBe(true);
    expect(coll.isMutating()).toBe(true);

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([newItem]);
    expect(coll.isCreating()).toBe(false);
    expect(coll.isProcessing()).toBe(false);
    expect(coll.isMutating()).toBe(false);

    const secondItem: Item = {id: -1, name: ';)'};

    coll.create({
      request: of(secondItem)
    }).subscribe();

    expect(coll.items()).toStrictEqual([newItem, secondItem]);

    coll.create({
      request: of(secondItem)
    }).subscribe();

    expect(coll.items()).toStrictEqual([newItem, secondItem]);
  });

  it('create many', () => {
    const {coll} = setup();

    const item1 = {id: -1, name: 'A'};
    const item2 = {id: 0, name: 'B'};
    const item3 = {id: 1, name: 'C'};
    const item4 = {id: 2, name: 'D'};
    const item5 = {id: 2, name: 'E'};
    const item6 = {id: 3, name: 'F'};
    const item7 = {id: 4, name: 'G'};

    coll.read({
      request: of([item1])
    }).subscribe();

    expect(coll.items()).toStrictEqual([item1]);

    coll.createMany({
      request: emit([item2, item3]),
    }).subscribe();

    expect(coll.items()).toStrictEqual([item1]);
    expect(coll.isCreating()).toBe(true);
    expect(coll.isUpdating()).toBe(false);
    expect(coll.isProcessing()).toBe(true);
    expect(coll.isMutating()).toBe(true);
    expect(coll.isSaving()).toBe(true);

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([item1, item2, item3]);
    expect(coll.isCreating()).toBe(false);
    expect(coll.isUpdating()).toBe(false);
    expect(coll.isProcessing()).toBe(false);
    expect(coll.isMutating()).toBe(false);
    expect(coll.isSaving()).toBe(false);

    // should not mutate - item5 is a duplicate of item4
    coll.createMany({
      request: [emit(item4), emit(item5)],
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([item1, item2, item3]);

    coll.createMany({
      request: [emit(item4), emit(item6)],
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([item1, item2, item3, item4, item6]);

    coll.createMany({
      request: of({items: [item7], totalCount: 0}),
    }).subscribe();

    expect(coll.items()).toStrictEqual([item1, item2, item3, item4, item6, item7]);
    expect(coll.totalCountFetched()).toStrictEqual(0);

    coll.createMany({
      request: emit({items: [], totalCount: 4815162342}),
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([item1, item2, item3, item4, item6, item7]);
    expect(coll.totalCountFetched()).toStrictEqual(4815162342);
  });

  it('read', () => {
    const {coll} = setup();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);

    coll.read({
      request: emit([{id: 1, name: 'A'}, {id: 2, name: 'B'}]),
    }).subscribe();

    expect(coll.isReading()).toStrictEqual(true);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(false);

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}], totalCount: 12})
    }).subscribe();

    expect(coll.items()).toStrictEqual([{id: 1, name: 'AN'}, {id: 2, name: 'BN'}]);
    expect(coll.totalCountFetched()).toStrictEqual(12);

    coll.setAllowFetchedDuplicates(false);
    coll.setThrowOnDuplicates(undefined);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}], totalCount: 10000}),
      keepExistingOnError: true,
    }).subscribe();

    expect(coll.items()).toStrictEqual([{id: 1, name: 'AN'}, {id: 2, name: 'BN'}]);
    expect(coll.totalCountFetched()).toStrictEqual(12);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}], totalCount: 10000}),
      keepExistingOnError: false,
    }).subscribe();

    expect(coll.items()).toStrictEqual([]);
    expect(coll.totalCountFetched()).toStrictEqual(undefined);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}]})
    }).subscribe();

    expect(coll.items()).toStrictEqual([]);
    expect(coll.totalCountFetched()).toStrictEqual(undefined);
  });

  it('read one', () => {
    const {coll} = setup();
    const item: Item = {id: 0, name: 'A'};
    const item1: Item = {id: 1, name: 'B'};
    const item2: Item = {id: 2, name: 'C'};
    const item3: Item = {id: 3, name: 'D'};
    const item3v2: Item = {id: 3, name: 'E'};

    coll.read({request: of([item1, item2, item3])}).subscribe();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.items()).toStrictEqual([item1, item2, item3]);

    coll.readOne({
      request: emit(item),
    }).subscribe();

    expect(coll.isReading()).toStrictEqual(true);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(false);

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([item1, item2, item3, item]);

    coll.readOne({
      request: emit(item3v2),
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.items()).toStrictEqual([item1, item2, item3v2, item]);

  });

  it('read many', () => {
    const {coll} = setup();
    const items: Item[] = [{id: 0, name: 'A'}, {id: 1, name: 'B'}, {id: 2, name: 'C'}];
    const newItems: Item[] = [{id: 3, name: 'D'}, {id: 4, name: 'E'}];
    const newItemsV2 = {items: [{id: 3, name: 'D!'}, {id: 4, name: 'E!'}], totalCount: 4815162342};

    coll.read({request: of(items)}).subscribe();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.items()).toStrictEqual(items);

    coll.readMany({
      request: emit(newItems),
    }).subscribe();

    expect(coll.isReading()).toStrictEqual(true);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(false);

    jest.runOnlyPendingTimers();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.items()).toStrictEqual([...items, ...newItems]);

    coll.readMany({
      request: emit(newItemsV2),
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.totalCountFetched()).toStrictEqual(4815162342);
    expect(coll.items()).toStrictEqual([...items, ...newItemsV2.items]);

  });

  it('refresh', () => {
    const {coll} = setup();
    const item1 = {id: 0, name: 'A'};
    const item2 = {id: 1, name: 'B'};
    const item3 = {id: 2, name: 'C'};
    const item4 = {id: 3, name: 'D'};
    const item1f = {id: 0, name: 'Af'};
    const item2f = {id: 1, name: 'Bf'};
    const item3f = {id: 2, name: 'Cf'};
    const item4f = {id: 3, name: 'Df'};

    coll.read({request: of([item1, item2])}).subscribe();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.refreshingItems()).toEqual([]);
    expect(coll.processingItems()).toEqual([]);
    expect(coll.items()).toStrictEqual([item1, item2]);

    coll.refresh({
      request: emit(item2f),
      item: item2
    }).subscribe();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.refreshingItems()).toEqual([item2]);
    expect(coll.processingItems()).toEqual([item2]);
    expect(coll.items()).toStrictEqual([item1, item2]);
    expect(coll.isItemRefreshing(item2)()).toBe(true);
    expect(coll.isItemProcessing(item2)()).toBe(true);
    expect(coll.isItemMutating(item2)()).toBe(false);
    expect(coll.isItemDeleting(item2)()).toBe(false);
    expect(coll.isItemUpdating(item2)()).toBe(false);

    jest.runOnlyPendingTimers();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.refreshingItems()).toEqual([]);
    expect(coll.items()).toStrictEqual([item1, item2f]);
    expect(coll.isItemRefreshing(item2)()).toBe(false);
    expect(coll.isItemProcessing(item2)()).toBe(false);
    expect(coll.isItemMutating(item2)()).toBe(false);
    expect(coll.isItemDeleting(item2)()).toBe(false);
    expect(coll.isItemUpdating(item2)()).toBe(false);

    coll.refreshMany({
      request: emit([item1f, item3]),
      items: [item1]
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.refreshingItems()).toEqual([]);
    expect(coll.items()).toStrictEqual([item1f, item2f, item3]);

    coll.refreshMany({
      request: [emit(item3f), emit(item4)],
      items: [item3]
    }).subscribe();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.refreshingItems()).toEqual([item3]);
    expect(coll.items()).toStrictEqual([item1f, item2f, item3]);

    jest.runOnlyPendingTimers();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.refreshingItems()).toEqual([]);
    expect(coll.items()).toStrictEqual([item1f, item2f, item3f, item4]);

    coll.refreshMany({
      request: emit({items: [item2f, item3f, item4f], totalCount: 4815162342}),
      items: [item3f, item4]
    }).subscribe();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.refreshingItems()).toEqual([item3f, item4]);
    expect(coll.items()).toStrictEqual([item1f, item2f, item3f, item4]);
    expect(coll.totalCountFetched()).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(coll.isReading()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.refreshingItems()).toEqual([]);
    expect(coll.items()).toStrictEqual([item1f, item2f, item3f, item4f]);
    expect(coll.totalCountFetched()).toStrictEqual(4815162342);
  });

  it('update', () => {
    const {coll} = setup();

    const item1 = {id: -1, name: 'A'};
    const item2 = {id: 0, name: 'B'};

    const item2Signal = signal(item2);

    expect(coll.isUpdating()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);

    coll.read({
      request: of([item1, item2])
    }).subscribe();

    const newItem2 = {id: 0, name: 'C'};

    expect(coll.isUpdating()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);

    expect(coll.updatingItems().length).toEqual(0);

    coll.update({
      request: emit(newItem2),
      item: item2,
    }).subscribe();

    expect(coll.items()).toStrictEqual([item1, item2]);
    expect(coll.updatingItems()).toStrictEqual([item2]);
    expect(coll.mutatingItems()).toStrictEqual([item2]);
    expect(coll.isItemUpdating(item2Signal)()).toStrictEqual(true);
    expect(coll.isItemUpdating(of(item2))()).toStrictEqual(true);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(true);
    expect(coll.isItemProcessing(item2Signal)()).toStrictEqual(true);
    expect(coll.isItemProcessing(of(item2))()).toStrictEqual(true);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(true);
    expect(coll.isItemMutating(item2Signal)()).toStrictEqual(true);
    expect(coll.isItemMutating(of(item2))()).toStrictEqual(true);
    expect(coll.isItemMutating(item2)()).toStrictEqual(true);
    expect(coll.isUpdating()).toStrictEqual(true);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(true);

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([item1, newItem2]);
    expect(coll.updatingItems()).toStrictEqual([]);
    expect(coll.mutatingItems()).toStrictEqual([]);
    expect(coll.isItemUpdating(item2Signal)()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(false);
    expect(coll.isItemProcessing(item2Signal)()).toStrictEqual(false);
    expect(coll.isItemProcessing(of(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(false);
    expect(coll.isItemMutating(item2Signal)()).toStrictEqual(false);
    expect(coll.isItemMutating(of(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(item2)()).toStrictEqual(false);
    expect(coll.isUpdating()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
  });

  it('update many', () => {
    const {coll} = setup();

    const item1 = {id: -1, name: 'A'};
    const item2 = {id: 0, name: 'B'};
    const item3 = {id: 1, name: 'C'};
    const item4 = {id: 2, name: 'D'};

    coll.read({
      request: of([item1, item2, item3, item4])
    }).subscribe();

    const newItem2 = {id: 0, name: 'X'};
    const newItem4 = {id: 2, name: 'Y'};

    coll.updateMany({
      request: emit([newItem2, newItem4]),
      items: [item2, item4],
    }).subscribe();

    expect(coll.updatingItems()).toStrictEqual([item2, item4]);
    expect(coll.mutatingItems()).toStrictEqual([item2, item4]);
    expect(coll.isUpdating()).toStrictEqual(true);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(true);
    expect(coll.isSaving()).toStrictEqual(true);

    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemUpdating(of(item2))()).toStrictEqual(true);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemMutating(of(item2))()).toStrictEqual(true);
    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemProcessing(of(item2))()).toStrictEqual(true);

    expect(coll.isItemUpdating(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item3))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemMutating(of(item3))()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemProcessing(of(item3))()).toStrictEqual(false);

    expect(coll.isItemUpdating(signal(item4))()).toStrictEqual(true);
    expect(coll.isItemUpdating(of(item4))()).toStrictEqual(true);
    expect(coll.isItemMutating(signal(item4))()).toStrictEqual(true);
    expect(coll.isItemMutating(of(item4))()).toStrictEqual(true);
    expect(coll.isItemProcessing(signal(item4))()).toStrictEqual(true);
    expect(coll.isItemProcessing(of(item4))()).toStrictEqual(true);

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([item1, newItem2, item3, newItem4]);
    expect(coll.updatingItems()).toStrictEqual([]);
    expect(coll.isUpdating()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.isSaving()).toStrictEqual(false);

    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(of(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(of(item2))()).toStrictEqual(false);

    expect(coll.isItemUpdating(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item3))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemMutating(of(item3))()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item3))()).toStrictEqual(false);
    expect(coll.isItemProcessing(of(item3))()).toStrictEqual(false);

    expect(coll.isItemUpdating(signal(item4))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item4))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item4))()).toStrictEqual(false);
    expect(coll.isItemMutating(of(item4))()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item4))()).toStrictEqual(false);
    expect(coll.isItemProcessing(of(item4))()).toStrictEqual(false);
  });

  it('delete', () => {
    const {coll} = setup();

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 0, name: 'B'};
    const item3 = {id: 3, name: 'B3'};
    const item4 = {id: 4, name: 'B4'};
    const item5 = {id: 5, name: 'B5'};
    const item6 = {id: 6, name: 'B6'};
    const item7 = {id: 7, name: 'B7'};

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

    expect(coll.items()).toStrictEqual([
      item1,
      item2,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.deletingItems()).toStrictEqual([]);
    expect(coll.isDeleting()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isSaving()).toStrictEqual(false);
    expect(coll.totalCountFetched()).toStrictEqual(7);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(of(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(of(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(item2)()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(of(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(item2)()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(of(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(item2)()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(false);

    coll.delete({
      request: emit(item2),
      item: item2,
    }).subscribe();

    expect(coll.items()).toStrictEqual([
      item1,
      item2,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.deletingItems()).toStrictEqual([item2]);
    expect(coll.isDeleting()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(true);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isSaving()).toStrictEqual(false);
    expect(coll.totalCountFetched()).toStrictEqual(7);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemProcessing(of(item2))()).toStrictEqual(true);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(true);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemMutating(of(item2))()).toStrictEqual(true);
    expect(coll.isItemMutating(item2)()).toStrictEqual(true);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(true);
    expect(coll.isItemDeleting(of(item2))()).toStrictEqual(true);
    expect(coll.isItemDeleting(item2)()).toStrictEqual(true);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(of(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(item2)()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(false);

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([
      item1,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.deletingItems()).toStrictEqual([]);
    expect(coll.isDeleting()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isSaving()).toStrictEqual(false);
    expect(coll.totalCountFetched()).toStrictEqual(7);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(of(item2))()).toStrictEqual(false);
    expect(coll.isItemProcessing(item2)()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(of(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(item2)()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(of(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(item2)()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(of(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(item2)()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(item2)()).toStrictEqual(false);

    coll.delete({
      request: of(null),
      item: item3,
      decrementTotalCount: 3,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.totalCountFetched()).toStrictEqual(4);

    coll.delete({
      request: of(null),
      item: item4,
      decrementTotalCount: true,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.totalCountFetched()).toStrictEqual(3);

    coll.delete({
      request: of({totalItems: 1}),
      item: item5,
      decrementTotalCount: 'totalItems',
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.totalCountFetched()).toStrictEqual(1);
  });

  it('delete many', () => {
    const {coll} = setup();

    const item1 = {id: -1, name: 'A'};
    const item2 = {id: 0, name: 'B'};
    const item3 = {id: 1, name: 'C'};
    const item4 = {id: 2, name: 'D'};
    const item5 = {id: 5, name: 'B5'};
    const item6 = {id: 6, name: 'B6'};
    const item7 = {id: 7, name: 'B7'};
    const item8 = {id: 8, name: 'B8'};
    const item9 = {id: 9, name: 'B9'};

    coll.read({
      request: of({
        items: [item1, item2, item3, item4, item5, item6, item7, item8, item9],
        totalCount: 200
      })
    }).subscribe();

    expect(coll.items()).toStrictEqual([item1, item2, item3, item4, item5, item6, item7, item8, item9]);
    expect(coll.deletingItems()).toStrictEqual([]);
    expect(coll.isDeleting()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isSaving()).toStrictEqual(false);
    expect(coll.totalCountFetched()).toStrictEqual(200);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);

    expect(coll.isItemProcessing(of(item3))()).toStrictEqual(false);
    expect(coll.isItemMutating(of(item3))()).toStrictEqual(false);
    expect(coll.isItemDeleting(of(item3))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(of(item3))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item3))()).toStrictEqual(false);

    coll.deleteMany({
      request: emit('ok'),
      items: [item3, item4],
    }).subscribe();

    expect(coll.items()).toStrictEqual([item1, item2, item3, item4, item5, item6, item7, item8, item9]);
    expect(coll.deletingItems()).toStrictEqual([item3, item4]);
    expect(coll.isDeleting()).toStrictEqual(true);
    expect(coll.isMutating()).toStrictEqual(true);
    expect(coll.isProcessing()).toStrictEqual(true);
    expect(coll.isSaving()).toStrictEqual(false);
    expect(coll.totalCountFetched()).toStrictEqual(200);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);

    expect(coll.isItemProcessing(of(item3))()).toStrictEqual(true);
    expect(coll.isItemMutating(of(item3))()).toStrictEqual(true);
    expect(coll.isItemDeleting(of(item3))()).toStrictEqual(true);
    expect(coll.isItemRefreshing(of(item3))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item3))()).toStrictEqual(false);

    jest.runOnlyPendingTimers();

    expect(coll.items()).toStrictEqual([item1, item2, item5, item6, item7, item8, item9]);
    expect(coll.deletingItems()).toStrictEqual([]);
    expect(coll.isDeleting()).toStrictEqual(false);
    expect(coll.isMutating()).toStrictEqual(false);
    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isSaving()).toStrictEqual(false);

    expect(coll.isItemProcessing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemMutating(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemDeleting(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item2))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item2))()).toStrictEqual(false);

    expect(coll.isItemProcessing(of(item3))()).toStrictEqual(false);
    expect(coll.isItemMutating(of(item3))()).toStrictEqual(false);
    expect(coll.isItemDeleting(of(item3))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(of(item3))()).toStrictEqual(false);
    expect(coll.isItemUpdating(of(item3))()).toStrictEqual(false);

    coll.deleteMany({
      request: emit('ok'),
      items: [item5],
      decrementTotalCount: 110,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.totalCountFetched()).toStrictEqual(90);

    coll.deleteMany({
      request: emit('ok'),
      items: [item6, item7],
      decrementTotalCount: true,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.totalCountFetched()).toStrictEqual(88);

    coll.deleteMany({
      request: emit({total: 10}),
      items: [item8],
      decrementTotalCount: 'total',
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(coll.totalCountFetched()).toStrictEqual(10);
  });

  it('status', () => {
    const {coll} = setup();

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};

    coll.read({request: of([item1, item2])}).subscribe();
    expect(coll.items()).toStrictEqual([item1, item2]);

    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item1))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item1))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item1))()).toStrictEqual(false);
    expect(coll.statuses().get(item1)?.has('selected')).toBeFalsy();

    coll.setItemStatus(item1, 'selected');

    expect(coll.isProcessing()).toStrictEqual(false);
    expect(coll.isItemProcessing(signal(item1))()).toStrictEqual(false);
    expect(coll.isItemUpdating(signal(item1))()).toStrictEqual(false);
    expect(coll.isItemRefreshing(signal(item1))()).toStrictEqual(false);
    expect(coll.statuses().get(item1)?.has('selected')).toBeTruthy();

    coll.setItemStatus(item1, 'awesome');

    expect(coll.statuses().get(item1)?.has('selected')).toBeTruthy();
    expect(coll.statuses().get(item1)?.has('awesome')).toBeTruthy();

    coll.deleteItemStatus(item1, 'awesome');

    expect(coll.statuses().get(item1)?.has('selected')).toBeTruthy();
    expect(coll.statuses().get(item1)?.has('awesome')).toBeFalsy();

    coll.deleteItemStatus(item1, 'selected');

    expect(coll.statuses().get(item1)?.has('selected')).toBeFalsy();
    expect(coll.statuses().get(item1)?.has('awesome')).toBeFalsy();

    coll.setItemStatus(item1, 'awesome');

    expect(coll.statuses().get(item1)?.has('awesome')).toBeTruthy();
  });

  it('unique status', () => {
    const {coll} = setup();

    const item1 = {id: -1, name: '#!'};
    const item2 = {id: 0, name: '!@'};

    coll.read({request: of([item1, item2])}).subscribe();
    expect(coll.items()).toStrictEqual([item1, item2]);

    expect(coll.status().get('focused')).toBeFalsy();

    coll.setUniqueStatus('focused', item2);
    coll.setUniqueStatus('reserved', item2);

    expect(coll.status().get('focused')).toStrictEqual(item2);

    coll.setUniqueStatus('chosen', item1);

    expect(coll.status().get('focused')).toStrictEqual(item2);
    expect(coll.status().get('chosen')).toStrictEqual(item1);
    expect(coll.status().get('reserved')).toStrictEqual(item2);

    coll.setUniqueStatus('chosen', item2, false);

    expect(coll.status().get('chosen')).toStrictEqual(item1);

    coll.setUniqueStatus('chosen', item1, false);

    expect(coll.status().get('chosen')).toBeFalsy();

    coll.deleteUniqueStatus('focused');

    expect(coll.status().get('focused')).toBeFalsy();
    expect(coll.status().get('chosen')).toBeFalsy();

    expect(coll.status().get('reserved')).toStrictEqual(item2);
    coll.setUniqueStatus('reserved', item1);
    expect(coll.status().get('reserved')).toStrictEqual(item1);
  });

  it('getItem', () => {
    const {coll} = setup();

    expect(coll.getItem({id: 1})()).toStrictEqual(undefined);

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};
    const item3 = {id: 3, name: 'C'};

    coll.read({
      request: emit([item1, item2, item3])
    }).subscribe();

    expect(coll.getItem({id: 1})()).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(coll.getItem({id: 1})()).toStrictEqual(item1);

    const itemSource = coll.getItem(emit(item2));

    expect(itemSource()).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(itemSource()).toStrictEqual(item2);
  });

  it('getItemByField', () => {
    const {coll} = setup();

    expect(coll.getItemByField('id', 1)()).toStrictEqual(undefined);

    const item1 = {id: 0, name: '!'};
    const item2 = {id: -1, name: '?'};
    const item3 = {id: 1, name: '*'};

    coll.read({
      request: emit([item1, item2, item3])
    }).subscribe();

    expect(coll.getItemByField('id', 1)()).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(coll.getItemByField('id', 0)()).toStrictEqual(item1);
    expect(coll.getItemByField(['id', 'name'], -1)()).toStrictEqual(item2);
    expect(coll.getItemByField(['id', 'name'], '*')()).toStrictEqual(item3);

    const itemSource = coll.getItemByField('id', emit(0));

    expect(itemSource()).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(itemSource()).toStrictEqual(item1);
  });

  it('custom comparator fn with multiple fields', () => {
    const {coll} = setup();
    coll.setOptions({
      comparator: (item1: Item, item2: Item) => (item1.id + item1.name) === (item2.id + item2.name),
      allowFetchedDuplicates: false,
      onDuplicateErrCallbackParam: 'DRY',
      throwOnDuplicates: false
    });

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};
    const item3 = {id: 1, name: 'B'};
    const item4 = {id: 2, name: 'B'};

    let errMsg = '';

    coll.read({
      request: of([item1, item2, item3, item4]),
      onError: (err: any) => errMsg = err as string,
    }).subscribe();

    expect(errMsg).toBe('DRY');
    expect(coll.getDuplicates([item1, item2, item3, item4])).toMatchObject(
      {
        '1': {
          '1': {'id': 2, 'name': 'B'},
          '3': {'id': 2, 'name': 'B'}
        }
      }
    );
  });

  it('should emit onCreate', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForCreate().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.create({
      request: emit({id: 1, name: 'A'})
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}]);
  });

  it('should emit onCreate for createMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForCreate().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.createMany({
      request: emit([{id: 1, name: 'A'}, {id: 2, name: 'B'}])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);
  });

  it('should not emit onCreate without subscribers', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    const s = coll.listenForCreate().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();
    s.unsubscribe();

    coll.create({
      request: emit({id: 1, name: 'A'})
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual(undefined);
  });

  it('should emit onRead', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.read({
      request: emit([{id: 1, name: 'A'}])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}]);
  });

  it('should emit onRead for readMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.readMany({
      request: emit([{id: 1, name: 'A'}, {id: 2, name: 'B'}])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);
  });

  it('should emit onRead for refresh', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{id: 1, name: 'A'}])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}]);

    coll.refresh({
      request: emit({id: 1, name: 'B'}),
      item: {id: 1},
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}]);
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'B'}]);
  });

  it('should emit onRead for refreshMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{id: 1, name: 'A'}, {id: 2, name: 'B'}])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);

    coll.refreshMany({
      request: emit([{id: 1, name: 'C'}, {id: 2, name: 'D'}]),
      items: [{id: 1}, {id: 2}],
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'C'}, {id: 2, name: 'D'}]);
  });

  it('should emit onUpdate', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForUpdate().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{id: 1, name: 'A'}])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.update({
      request: emit({id: 1, name: 'B'}),
      item: {id: 1},
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'B'}]);
  });

  it('should emit onItemsUpdate', () => {
    const {coll} = setup();
    const item = {id: 1, name: 'A'};

    let lastEmitted: any = undefined;
    coll.listenForItemsUpdate([item]).subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([item])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toStrictEqual([item]);
    lastEmitted = undefined;

    coll.update({
      request: emit({id: 1, name: 'B'}),
      item: item,
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'B'}]);
  });

  it('should emit onUpdate for updateMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForUpdate().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{id: 1, name: 'A'}])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.updateMany({
      request: emit([{id: 1, name: 'B'}, {id: 2, name: 'A'}]),
      items: [{id: 1}, {id: 2}],
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1, name: 'B'}, {id: 2, name: 'A'}]);
  });

  it('should emit onDelete', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForDelete().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{id: 1, name: 'A'}])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.delete({
      request: emit(null),
      item: {id: 1}
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1}]);
  });

  it('should emit onItemsDelete', () => {
    const {coll} = setup();
    const item = {id: 1, name: 'A'};
    let lastEmitted: any = undefined;
    coll.listenForItemsDeletion([item]).subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.delete({
      request: emit(null),
      item: {id: 1}
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1}]);
  });

  it('should emit onDelete for deleteMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForDelete().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: emit([{id: 1, name: 'A'}, {id: 2, name: 'B'}])
    }).subscribe();

    jest.runOnlyPendingTimers();
    expect(lastEmitted).toBeFalsy();

    coll.deleteMany({
      request: emit(null),
      items: [{id: 1}, {id: 2}]
    }).subscribe();

    expect(lastEmitted).toBeFalsy();
    jest.runAllTimers();
    expect(lastEmitted).toStrictEqual([{id: 1}, {id: 2}]);
  });
});
