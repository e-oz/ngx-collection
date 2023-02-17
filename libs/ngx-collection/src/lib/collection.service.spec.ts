import { CollectionService } from './collection.service';
import { map, Observable, of, timer } from 'rxjs';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

interface Item {
  id: number;
  name: string;
}

type ViewModel = ReturnType<CollectionService<Item>['getViewModel']> extends Observable<infer VM> ? Partial<VM> : never;
type ItemViewModel = ReturnType<CollectionService<Item>['getItemViewModel']> extends Observable<infer IVM> ? Partial<IVM> : never;

function readState<T>(stream: Observable<T>): T {
  let t: T | undefined = undefined;
  stream.subscribe((v) => t = v);
  return t as T;
}

function setup() {
  const coll = new CollectionService<Item>({throwOnDuplicates: 'duplicate', comparatorFields: ['id']});
  const vm = coll.getViewModel();

  return {
    coll,
    vm,
  };
}

function emit<T>(result: T) {
  return timer(1).pipe(map(() => result));
}

describe('Collection Service', () => {
  it('create', () => {
    const {coll, vm} = setup();
    const newItem: Item = {id: 0, name: ':)'};

    expect(readState(vm)).toMatchObject<ViewModel>({isCreating: false, isProcessing: false, isMutating: false});

    coll.create({
      request: emit(newItem)
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({isCreating: true, isProcessing: true, isMutating: true});

    jest.runOnlyPendingTimers();

    expect(readState(coll.items$)).toStrictEqual([newItem]);
    expect(readState(vm)).toMatchObject<ViewModel>({isCreating: false, isProcessing: false, isMutating: false});

    const secondItem: Item = {id: -1, name: ';)'};

    coll.create({
      request: of(secondItem)
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([newItem, secondItem]);

    coll.create({
      request: of(secondItem)
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([newItem, secondItem]);
  });

  it('create many', () => {
    const {coll, vm} = setup();

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

    expect(readState(coll.items$)).toStrictEqual([item1]);

    coll.createMany({
      request: emit([item2, item3]),
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isCreating: true,
      isUpdating: false,
      isProcessing: true,
      isMutating: true,
      isSaving: true,
      items: [item1],
    });

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isCreating: false,
      isUpdating: false,
      isProcessing: false,
      isMutating: false,
      isSaving: false,
      items: [item1, item2, item3],
    });

    // should not mutate - item5 is a duplicate of item4
    coll.createMany({
      request: [emit(item4), emit(item5)],
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      items: [item1, item2, item3],
    });

    coll.createMany({
      request: [emit(item4), emit(item6)],
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      items: [item1, item2, item3, item4, item6],
    });

    coll.createMany({
      request: of({items: [item7], totalCount: 0}),
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({
      items: [item1, item2, item3, item4, item6, item7],
      totalCountFetched: 0,
    });

    coll.createMany({
      request: emit({items: [], totalCount: 4815162342}),
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      items: [item1, item2, item3, item4, item6, item7],
      totalCountFetched: 4815162342,
    });
  });

  it('read', () => {
    const {coll, vm} = setup();

    expect(readState(vm)).toMatchObject<ViewModel>({isReading: false, isProcessing: false, isMutating: false});

    coll.read({
      request: emit([{id: 1, name: 'A'}, {id: 2, name: 'B'}]),
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({isReading: true, isProcessing: true, isMutating: false});

    jest.runOnlyPendingTimers();

    expect(readState(coll.items$)).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}], totalCount: 12})
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([{id: 1, name: 'AN'}, {id: 2, name: 'BN'}]);
    expect(readState(vm).totalCountFetched).toStrictEqual(12);

    coll.setAllowFetchedDuplicates(false);
    coll.setThrowOnDuplicates(undefined);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}], totalCount: 10000}),
      keepExistingOnError: true,
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([{id: 1, name: 'AN'}, {id: 2, name: 'BN'}]);
    expect(readState(vm).totalCountFetched).toStrictEqual(12);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}], totalCount: 10000}),
      keepExistingOnError: false,
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([]);
    expect(readState(vm).totalCountFetched).toStrictEqual(undefined);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}]})
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([]);
    expect(readState(vm).totalCountFetched).toStrictEqual(undefined);
  });

  it('read one', () => {
    const {coll, vm} = setup();
    const item: Item = {id: 0, name: 'A'};
    const item1: Item = {id: 1, name: 'B'};
    const item2: Item = {id: 2, name: 'C'};
    const item3: Item = {id: 3, name: 'D'};
    const item3v2: Item = {id: 3, name: 'E'};

    coll.read({request: of([item1, item2, item3])}).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: [item1, item2, item3],
    });

    coll.readOne({
      request: emit(item),
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({isReading: true, isProcessing: true, isMutating: false});

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: [item1, item2, item3, item],
    });

    coll.readOne({
      request: emit(item3v2),
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: [item1, item2, item3v2, item],
    });
  });

  it('read many', () => {
    const {coll, vm} = setup();
    const items: Item[] = [{id: 0, name: 'A'}, {id: 1, name: 'B'}, {id: 2, name: 'C'}];
    const newItems: Item[] = [{id: 3, name: 'D'}, {id: 4, name: 'E'}];
    const newItemsV2 = {items: [{id: 3, name: 'D!'}, {id: 4, name: 'E!'}], totalCount: 4815162342};

    coll.read({request: of(items)}).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: items,
    });

    coll.readMany({
      request: emit(newItems),
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({isReading: true, isProcessing: true, isMutating: false});

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: [...items, ...newItems],
    });

    coll.readMany({
      request: emit(newItemsV2),
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: [...items, ...newItemsV2.items],
      totalCountFetched: 4815162342,
    });
  });

  it('refresh', () => {
    const {coll, vm} = setup();
    const item1 = {id: 0, name: 'A'};
    const item2 = {id: 1, name: 'B'};
    const item3 = {id: 2, name: 'C'};
    const item4 = {id: 3, name: 'D'};
    const item1f = {id: 0, name: 'Af'};
    const item2f = {id: 1, name: 'Bf'};
    const item3f = {id: 2, name: 'Cf'};
    const item4f = {id: 3, name: 'Df'};

    coll.read({request: of([item1, item2])}).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      refreshingItems: [],
      items: [item1, item2],
    });

    coll.refresh({
      request: emit(item2f),
      item: item2
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: true,
      isMutating: false,
      refreshingItems: [item2],
      items: [item1, item2]
    });

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      refreshingItems: [],
      items: [item1, item2f],
    });

    coll.refreshMany({
      request: emit([item1f, item3]),
      items: [item1]
    }).subscribe();

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      refreshingItems: [],
      items: [item1f, item2f, item3],
    });

    coll.refreshMany({
      request: [emit(item3f), emit(item4)],
      items: [item3]
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: true,
      isMutating: false,
      refreshingItems: [item3],
      items: [item1f, item2f, item3],
    });

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      refreshingItems: [],
      items: [item1f, item2f, item3f, item4],
    });

    coll.refreshMany({
      request: emit({items: [item2f, item3f, item4f], totalCount: 4815162342}),
      items: [item3f, item4]
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: true,
      isMutating: false,
      refreshingItems: [item3f, item4],
      items: [item1f, item2f, item3f, item4],
      totalCountFetched: undefined,
    });

    jest.runOnlyPendingTimers();

    expect(readState(vm)).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      refreshingItems: [],
      items: [item1f, item2f, item3f, item4f],
      totalCountFetched: 4815162342,
    });
  });

  it('update', () => {
    const {coll, vm} = setup();

    const item1 = {id: -1, name: 'A'};
    const item2 = {id: 0, name: 'B'};

    const ivm = coll.getItemViewModel(of(item2));

    expect(readState(vm)).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false});

    coll.read({
      request: of([item1, item2]),
      onSuccess: () => {throw 'oops';}
    }).subscribe();

    const newItem2 = {id: 0, name: 'C'};

    expect(readState(vm)).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false});
    expect(readState(ivm)).toMatchObject({isUpdating: false, isMutating: false, isProcessing: false});
    expect(readState(coll.updatingItems$).length).toEqual(0);

    coll.update({
      request: emit(newItem2),
      item: item2,
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([item1, item2]);
    expect(readState(coll.updatingItems$)).toStrictEqual([item2]);
    expect(readState(coll.mutatingItems$)).toStrictEqual([item2]);
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isUpdating: true, isMutating: true, isProcessing: true});
    expect(readState(vm)).toMatchObject<ViewModel>({isUpdating: true, isProcessing: true, isMutating: true, isSaving: true});

    jest.runOnlyPendingTimers();

    expect(readState(coll.items$)).toStrictEqual([item1, newItem2]);
    expect(readState(coll.updatingItems$)).toStrictEqual([]);
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isUpdating: false, isMutating: false, isProcessing: false});
    expect(readState(vm)).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false, isSaving: false});
  });

  it('update many', () => {
    const {coll, vm} = setup();

    const item1 = {id: -1, name: 'A'};
    const item2 = {id: 0, name: 'B'};
    const item3 = {id: 1, name: 'C'};
    const item4 = {id: 2, name: 'D'};

    const ivm2 = coll.getItemViewModel(of(item2));
    const ivm3 = coll.getItemViewModel(of(item3));
    const ivm4 = coll.getItemViewModel(of(item4));

    coll.read({
      request: of([item1, item2, item3, item4])
    }).subscribe();

    const newItem2 = {id: 0, name: 'X'};
    const newItem4 = {id: 2, name: 'Y'};

    coll.updateMany({
      request: emit([newItem2, newItem4]),
      items: [item2, item4],
    }).subscribe();

    expect(readState(coll.updatingItems$)).toStrictEqual([item2, item4]);
    expect(readState(coll.mutatingItems$)).toStrictEqual([item2, item4]);
    expect(readState(vm)).toMatchObject<ViewModel>({isUpdating: true, isProcessing: true, isMutating: true, isSaving: true});
    expect(readState(ivm2)).toMatchObject<ItemViewModel>({isUpdating: true, isMutating: true, isProcessing: true});
    expect(readState(ivm3)).toMatchObject<ItemViewModel>({isUpdating: false, isMutating: false, isProcessing: false});
    expect(readState(ivm4)).toMatchObject<ItemViewModel>({isUpdating: true, isMutating: true, isProcessing: true});

    jest.runOnlyPendingTimers();

    expect(readState(coll.items$)).toStrictEqual([item1, newItem2, item3, newItem4]);
    expect(readState(coll.updatingItems$)).toStrictEqual([]);
    expect(readState(vm)).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false, isSaving: false});
    expect(readState(ivm2)).toMatchObject<ItemViewModel>({isUpdating: false, isMutating: false, isProcessing: false});
    expect(readState(ivm3)).toMatchObject<ItemViewModel>({isUpdating: false, isMutating: false, isProcessing: false});
    expect(readState(ivm4)).toMatchObject<ItemViewModel>({isUpdating: false, isMutating: false, isProcessing: false});
  });

  it('delete', () => {
    const {coll, vm} = setup();

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 0, name: 'B'};
    const item3 = {id: 3, name: 'B3'};
    const item4 = {id: 4, name: 'B4'};
    const item5 = {id: 5, name: 'B5'};
    const item6 = {id: 6, name: 'B6'};
    const item7 = {id: 7, name: 'B7'};

    const ivm = coll.getItemViewModel(of(item2));

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

    expect(readState(coll.items$)).toStrictEqual([
      item1,
      item2,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(readState(coll.deletingItems$)).toStrictEqual([]);
    expect(readState(vm)).toMatchObject<ViewModel>({
      isDeleting: false,
      isMutating: false,
      isProcessing: false,
      isSaving: false,
      totalCountFetched: 7,
    });
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});

    coll.delete({
      request: emit(item2),
      item: item2,
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([
      item1,
      item2,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(readState(coll.deletingItems$)).toStrictEqual([item2]);
    expect(readState(vm)).toMatchObject<ViewModel>({
      isDeleting: true,
      isMutating: true,
      isProcessing: true,
      isSaving: false,
      totalCountFetched: 7,
    });
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isProcessing: true, isMutating: true, isDeleting: true, isRefreshing: false, isUpdating: false});

    jest.runOnlyPendingTimers();

    expect(readState(coll.items$)).toStrictEqual([
      item1,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(readState(coll.deletingItems$)).toStrictEqual([]);
    expect(readState(vm)).toMatchObject<ViewModel>({
      isDeleting: false,
      isMutating: false,
      isProcessing: false,
      isSaving: false,
      totalCountFetched: 7,
    });
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});

    coll.delete({
      request: of(null),
      item: item3,
      decrementTotalCount: 3,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(readState(vm)).toMatchObject<ViewModel>({totalCountFetched: 4});

    coll.delete({
      request: of(null),
      item: item4,
      decrementTotalCount: true,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(readState(vm)).toMatchObject<ViewModel>({totalCountFetched: 3});

    coll.delete({
      request: of({totalItems: 1}),
      item: item5,
      decrementTotalCount: 'totalItems',
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(readState(vm)).toMatchObject<ViewModel>({totalCountFetched: 1});
  });

  it('delete many', () => {
    const {coll, vm} = setup();

    const item1 = {id: -1, name: 'A'};
    const item2 = {id: 0, name: 'B'};
    const item3 = {id: 1, name: 'C'};
    const item4 = {id: 2, name: 'D'};
    const item5 = {id: 5, name: 'B5'};
    const item6 = {id: 6, name: 'B6'};
    const item7 = {id: 7, name: 'B7'};
    const item8 = {id: 8, name: 'B8'};
    const item9 = {id: 9, name: 'B9'};

    const ivm2 = coll.getItemViewModel(of(item2));
    const ivm3 = coll.getItemViewModel(of(item3));

    coll.read({
      request: of({
        items: [item1, item2, item3, item4, item5, item6, item7, item8, item9],
        totalCount: 200
      })
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([item1, item2, item3, item4, item5, item6, item7, item8, item9]);
    expect(readState(coll.deletingItems$)).toStrictEqual([]);
    expect(readState(vm)).toMatchObject<ViewModel>({
      isDeleting: false,
      isMutating: false,
      isProcessing: false,
      isSaving: false,
      totalCountFetched: 200,
    });
    expect(readState(ivm2)).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});
    expect(readState(ivm3)).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});

    coll.deleteMany({
      request: emit('ok'),
      items: [item3, item4],
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([item1, item2, item3, item4, item5, item6, item7, item8, item9]);
    expect(readState(coll.deletingItems$)).toStrictEqual([item3, item4]);
    expect(readState(vm)).toMatchObject<ViewModel>({
      isDeleting: true,
      isMutating: true,
      isProcessing: true,
      isSaving: false,
      totalCountFetched: 200,
    });
    expect(readState(ivm2)).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});
    expect(readState(ivm3)).toMatchObject<ItemViewModel>({isProcessing: true, isMutating: true, isDeleting: true, isRefreshing: false, isUpdating: false});

    jest.runOnlyPendingTimers();

    expect(readState(coll.items$)).toStrictEqual([item1, item2, item5, item6, item7, item8, item9]);
    expect(readState(coll.deletingItems$)).toStrictEqual([]);
    expect(readState(vm)).toMatchObject<ViewModel>({isDeleting: false, isMutating: false, isProcessing: false, isSaving: false});
    expect(readState(ivm2)).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});
    expect(readState(ivm3)).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});

    coll.deleteMany({
      request: emit('ok'),
      items: [item5],
      decrementTotalCount: 110,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(readState(vm)).toMatchObject<ViewModel>({
      totalCountFetched: 90,
    });

    coll.deleteMany({
      request: emit('ok'),
      items: [item6, item7],
      decrementTotalCount: true,
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(readState(vm)).toMatchObject<ViewModel>({
      totalCountFetched: 88,
    });

    coll.deleteMany({
      request: emit({total: 10}),
      items: [item8],
      decrementTotalCount: 'total',
    }).subscribe();
    jest.runOnlyPendingTimers();
    expect(readState(vm)).toMatchObject<ViewModel>({
      totalCountFetched: 10,
    });
  });

  it('status', () => {
    const {coll, vm} = setup();

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};

    const ivm = coll.getItemViewModel(of(item1));

    coll.read({request: of([item1, item2])}).subscribe();
    expect(readState(coll.items$)).toStrictEqual([item1, item2]);

    expect(readState(vm)).toMatchObject<ViewModel>({isProcessing: false});
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isProcessing: false, isUpdating: false, isRefreshing: false});
    expect(readState(vm).statuses.get(item1)?.has('selected')).toBeFalsy();

    coll.setItemStatus(item1, 'selected');

    expect(readState(vm)).toMatchObject<ViewModel>({isProcessing: false});
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isProcessing: false, isUpdating: false, isRefreshing: false});
    expect(readState(vm).statuses.get(item1)?.has('selected')).toBeTruthy();

    coll.setItemStatus(item1, 'awesome');

    expect(readState(vm).statuses.get(item1)?.has('selected')).toBeTruthy();
    expect(readState(vm).statuses.get(item1)?.has('awesome')).toBeTruthy();

    coll.deleteItemStatus(item1, 'awesome');

    expect(readState(vm).statuses.get(item1)?.has('selected')).toBeTruthy();
    expect(readState(vm).statuses.get(item1)?.has('awesome')).toBeFalsy();

    coll.deleteItemStatus(item1, 'selected');

    expect(readState(vm).statuses.get(item1)?.has('selected')).toBeFalsy();
    expect(readState(vm).statuses.get(item1)?.has('awesome')).toBeFalsy();

    coll.setItemStatus(item1, 'awesome');

    expect(readState(vm).statuses.get(item1)?.has('awesome')).toBeTruthy();
  });

  it('unique status', () => {
    const {coll, vm} = setup();

    const item1 = {id: -1, name: '#!'};
    const item2 = {id: 0, name: '!@'};

    coll.read({request: of([item1, item2])}).subscribe();
    expect(readState(coll.items$)).toStrictEqual([item1, item2]);

    expect(readState(vm).status.get('focused')).toBeFalsy();

    coll.setUniqueStatus('focused', item2);
    coll.setUniqueStatus('reserved', item2);

    expect(readState(vm).status.get('focused')).toStrictEqual(item2);

    coll.setUniqueStatus('chosen', item1);

    expect(readState(vm).status.get('focused')).toStrictEqual(item2);
    expect(readState(vm).status.get('chosen')).toStrictEqual(item1);
    expect(readState(vm).status.get('reserved')).toStrictEqual(item2);

    coll.setUniqueStatus('chosen', item2, false);

    expect(readState(vm).status.get('chosen')).toStrictEqual(item1);

    coll.setUniqueStatus('chosen', item1, false);

    expect(readState(vm).status.get('chosen')).toBeFalsy();

    coll.deleteUniqueStatus('focused');

    expect(readState(vm).status.get('focused')).toBeFalsy();
    expect(readState(vm).status.get('chosen')).toBeFalsy();

    expect(readState(vm).status.get('reserved')).toStrictEqual(item2);
    coll.setUniqueStatus('reserved', item1);
    expect(readState(vm).status.get('reserved')).toStrictEqual(item1);
  });

  it('getItem', () => {
    const {coll} = setup();

    expect(readState(coll.getItem({id: 1}))).toStrictEqual(undefined);

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};
    const item3 = {id: 3, name: 'C'};

    coll.read({
      request: emit([item1, item2, item3])
    }).subscribe();

    expect(readState(coll.getItem({id: 1}))).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(readState(coll.getItem({id: 1}))).toStrictEqual(item1);

    const itemSource$ = coll.getItem(emit(item2));

    expect(readState(itemSource$)).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(readState(itemSource$)).toStrictEqual(item2);
  });

  it('getItemByField', () => {
    const {coll} = setup();

    expect(readState(coll.getItemByField('id', 1))).toStrictEqual(undefined);

    const item1 = {id: 0, name: '!'};
    const item2 = {id: -1, name: '?'};
    const item3 = {id: 1, name: '*'};

    coll.read({
      request: emit([item1, item2, item3])
    }).subscribe();

    expect(readState(coll.getItemByField('id', 1))).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(readState(coll.getItemByField('id', 0))).toStrictEqual(item1);
    expect(readState(coll.getItemByField(['id', 'name'], -1))).toStrictEqual(item2);
    expect(readState(coll.getItemByField(['id', 'name'], '*'))).toStrictEqual(item3);

    const itemSource$ = coll.getItemByField('id', emit(0));

    expect(readState(itemSource$)).toStrictEqual(undefined);

    jest.runOnlyPendingTimers();

    expect(readState(itemSource$)).toStrictEqual(item1);
  });

  it('getDuplicates', () => {
    const {coll} = setup();

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};
    const item3 = {id: 3, name: 'C'};
    const item2d = {id: 1, name: '!A'};

    expect(coll.getDuplicates([item1, item2, item3])).toStrictEqual(null);

    const expected = new Map();
    expected.set(1, {1: item2, 3: item2d});
    expect(coll.getDuplicates([item1, item2, item3, item2d])).toMatchObject(expected);

    class DColl extends CollectionService<number> {
      override hasDuplicates(items: number[]) {
        return super.hasDuplicates(items);
      }
    }

    const dColl = new DColl({
      comparator: (a, b) => a === b
    });
    expect(dColl.hasDuplicates(
      [0, 1, 2, 3, 4, 5, 2]
    )).toStrictEqual(2);
    expect(dColl.hasDuplicates(
      [0, 0, 2, 3, 4, 5, 2]
    )).toStrictEqual(0);
    expect(dColl.hasDuplicates(
      [0, 1, 1, 3, 4, 5, 2]
    )).toStrictEqual(1);
    expect(dColl.hasDuplicates(
      [0, 1, 2, 3, 4, 5, 5]
    )).toStrictEqual(5);
    expect(dColl.hasDuplicates(
      [0, 1, 2, 3, 2, 4, 5]
    )).toStrictEqual(2);
  });

  it('custom comparator fn with multiple fields', () => {
    const coll = new CollectionService<Item>({
      comparator: (item1: Item, item2: Item) => (item1.id + item1.name) === (item2.id + item2.name),
      allowFetchedDuplicates: false,
      onDuplicateErrCallbackParam: 'DRY'
    });

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};
    const item3 = {id: 1, name: 'B'};
    const item4 = {id: 2, name: 'B'};

    let errMsg = '';

    coll.read({
      request: of([item1, item2, item3, item4]),
      onError: (err) => errMsg = err as string,
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
    coll.listenForCreate().subscribe(v => lastEmitted = v);

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
    coll.listenForCreate().subscribe(v => lastEmitted = v);

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
    const s = coll.listenForCreate().subscribe(v => lastEmitted = v);

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
    coll.listenForRead().subscribe(v => lastEmitted = v);

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
    coll.listenForRead().subscribe(v => lastEmitted = v);

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
    coll.listenForRead().subscribe(v => lastEmitted = v);

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
    coll.listenForRead().subscribe(v => lastEmitted = v);

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
    coll.listenForUpdate().subscribe(v => lastEmitted = v);

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

  it('should emit onUpdate for updateMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForUpdate().subscribe(v => lastEmitted = v);

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
    coll.listenForDelete().subscribe(v => lastEmitted = v);

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

  it('should emit onDelete for deleteMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForDelete().subscribe(v => lastEmitted = v);

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
