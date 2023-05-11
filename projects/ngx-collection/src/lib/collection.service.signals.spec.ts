import { CollectionService } from './collection.service';
import { Observable } from 'rxjs';
import { computed, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

type Item = {
  id: number;
  name: string;
}

type ViewModel = ReturnType<CollectionService<Item>['getViewModel']> extends Observable<infer VM> ? Partial<VM> : never;
type ItemViewModel = ReturnType<CollectionService<Item>['getItemViewModel']> extends Observable<infer IVM> ? Partial<IVM> : never;

function setup() {
  const coll = new CollectionService<Item>(
    {throwOnDuplicates: 'duplicate', comparatorFields: ['id']},
    TestBed.inject(Injector)
  );
  const vm = coll.getViewModelSignal();

  return {
    coll,
    vm,
  };
}

describe('Collection Service (Signals)', () => {
  it('create', () => {
    const {coll, vm} = setup();
    const newItem: Item = {id: 0, name: ':)'};

    expect(vm()).toMatchObject<ViewModel>({isCreating: false, isProcessing: false, isMutating: false});

    coll.create({
      request: signal(newItem)
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([newItem]);
    expect(vm()).toMatchObject<ViewModel>({isCreating: false, isProcessing: false, isMutating: false});

    const secondItem: Item = {id: -1, name: ';)'};

    coll.create({
      request: signal(secondItem)
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([newItem, secondItem]);

    coll.create({
      request: signal(secondItem)
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([newItem, secondItem]);
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
      request: signal([item1])
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([item1]);

    coll.createMany({
      request: signal([item2, item3]),
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      isCreating: false,
      isUpdating: false,
      isProcessing: false,
      isMutating: false,
      isSaving: false,
      items: [item1, item2, item3],
    });

    // should not mutate - item5 is a duplicate of item4
    coll.createMany({
      request: [signal(item4), signal(item5)],
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      items: [item1, item2, item3],
    });

    coll.createMany({
      request: [signal(item4), signal(item6)],
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      items: [item1, item2, item3, item4, item6],
    });

    coll.createMany({
      request: signal({items: [item7], totalCount: 0}),
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      items: [item1, item2, item3, item4, item6, item7],
      totalCountFetched: 0,
    });

    coll.createMany({
      request: signal({items: [], totalCount: 4815162342}),
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      items: [item1, item2, item3, item4, item6, item7],
      totalCountFetched: 4815162342,
    });
  });

  it('read', () => {
    const {coll, vm} = setup();

    expect(vm()).toMatchObject<ViewModel>({isReading: false, isProcessing: false, isMutating: false});

    coll.read({
      request: signal([{id: 1, name: 'A'}, {id: 2, name: 'B'}]),
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);

    coll.read({
      request: signal({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}], totalCount: 12})
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([{id: 1, name: 'AN'}, {id: 2, name: 'BN'}]);
    expect(vm().totalCountFetched).toStrictEqual(12);

    coll.setAllowFetchedDuplicates(false);
    coll.setThrowOnDuplicates(undefined);

    coll.read({
      request: signal({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}], totalCount: 10000}),
      keepExistingOnError: true,
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([{id: 1, name: 'AN'}, {id: 2, name: 'BN'}]);
    expect(vm().totalCountFetched).toStrictEqual(12);

    coll.read({
      request: signal({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}], totalCount: 10000}),
      keepExistingOnError: false,
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([]);
    expect(vm().totalCountFetched).toStrictEqual(undefined);

    coll.read({
      request: signal({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}]})
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([]);
    expect(vm().totalCountFetched).toStrictEqual(undefined);
  });

  it('read one', () => {
    const {coll, vm} = setup();
    const item: Item = {id: 0, name: 'A'};
    const item1: Item = {id: 1, name: 'B'};
    const item2: Item = {id: 2, name: 'C'};
    const item3: Item = {id: 3, name: 'D'};
    const item3v2: Item = {id: 3, name: 'E'};

    coll.read({request: signal([item1, item2, item3])}).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: [item1, item2, item3],
    });

    coll.readOne({
      request: signal(item),
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: [item1, item2, item3, item],
    });

    coll.readOne({
      request: signal(item3v2),
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
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

    coll.read({request: signal(items)}).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: items,
    });

    coll.readMany({
      request: signal(newItems),
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      items: [...items, ...newItems],
    });

    coll.readMany({
      request: signal(newItemsV2),
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
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

    coll.read({request: signal([item1, item2])}).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      refreshingItems: [],
      items: [item1, item2],
    });

    coll.refresh({
      request: signal(item2f),
      item: item2
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      refreshingItems: [],
      items: [item1, item2f],
    });

    coll.refreshMany({
      request: signal([item1f, item3]),
      items: [item1]
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      refreshingItems: [],
      items: [item1f, item2f, item3],
    });

    coll.refreshMany({
      request: [signal(item3f), signal(item4)],
      items: [item3]
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      isReading: false,
      isProcessing: false,
      isMutating: false,
      refreshingItems: [],
      items: [item1f, item2f, item3f, item4],
    });

    coll.refreshMany({
      request: signal({items: [item2f, item3f, item4f], totalCount: 4815162342}),
      items: [item3f, item4]
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
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

    const ivm = coll.getItemViewModelSignal(signal(item2));

    expect(vm()).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false});

    coll.read({
      request: signal([item1, item2])
    }).subscribe();

    const newItem2 = {id: 0, name: 'C'};

    expect(vm()).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false});
    expect(ivm()).toMatchObject({isUpdating: false, isMutating: false, isProcessing: false});
    expect(coll.updatingItemsSignal().length).toEqual(0);

    coll.update({
      request: signal(newItem2),
      item: item2,
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([item1, newItem2]);
    expect(coll.updatingItemsSignal()).toStrictEqual([]);
    expect(ivm()).toMatchObject<ItemViewModel>({isUpdating: false, isMutating: false, isProcessing: false});
    expect(vm()).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false, isSaving: false});
  });

  it('update many', () => {
    const {coll, vm} = setup();

    const item1 = {id: -1, name: 'A'};
    const item2 = {id: 0, name: 'B'};
    const item3 = {id: 1, name: 'C'};
    const item4 = {id: 2, name: 'D'};

    const ivm2 = coll.getItemViewModelSignal(signal(item2));
    const ivm3 = coll.getItemViewModelSignal(signal(item3));
    const ivm4 = coll.getItemViewModelSignal(signal(item4));

    coll.read({
      request: signal([item1, item2, item3, item4])
    }).subscribe();

    const newItem2 = {id: 0, name: 'X'};
    const newItem4 = {id: 2, name: 'Y'};

    coll.updateMany({
      request: signal([newItem2, newItem4]),
      items: [item2, item4],
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([item1, newItem2, item3, newItem4]);
    expect(coll.updatingItemsSignal()).toStrictEqual([]);
    expect(vm()).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false, isSaving: false});
    expect(ivm2()).toMatchObject<ItemViewModel>({isUpdating: false, isMutating: false, isProcessing: false});
    expect(ivm3()).toMatchObject<ItemViewModel>({isUpdating: false, isMutating: false, isProcessing: false});
    expect(ivm4()).toMatchObject<ItemViewModel>({isUpdating: false, isMutating: false, isProcessing: false});
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

    const ivm = coll.getItemViewModelSignal(signal(item2));

    coll.read({
      request: signal({
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

    expect(coll.itemsSignal()).toStrictEqual([
      item1,
      item2,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.deletingItemsSignal()).toStrictEqual([]);
    expect(vm()).toMatchObject<ViewModel>({
      isDeleting: false,
      isMutating: false,
      isProcessing: false,
      isSaving: false,
      totalCountFetched: 7,
    });
    expect(ivm()).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});

    coll.delete({
      request: signal(item2),
      item: item2,
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([
      item1,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.deletingItemsSignal()).toStrictEqual([]);
    expect(vm()).toMatchObject<ViewModel>({
      isDeleting: false,
      isMutating: false,
      isProcessing: false,
      isSaving: false,
      totalCountFetched: 7,
    });
    expect(ivm()).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});

    coll.delete({
      request: signal(null),
      item: item3,
      decrementTotalCount: 3,
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({totalCountFetched: 4});

    coll.delete({
      request: signal(null),
      item: item4,
      decrementTotalCount: true,
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({totalCountFetched: 3});

    coll.delete({
      request: signal({totalItems: 1}),
      item: item5,
      decrementTotalCount: 'totalItems',
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({totalCountFetched: 1});
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

    const ivm2 = coll.getItemViewModelSignal(signal(item2));
    const ivm3 = coll.getItemViewModelSignal(signal(item3));

    coll.read({
      request: signal({
        items: [item1, item2, item3, item4, item5, item6, item7, item8, item9],
        totalCount: 200
      })
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([item1, item2, item3, item4, item5, item6, item7, item8, item9]);
    expect(coll.deletingItemsSignal()).toStrictEqual([]);
    expect(vm()).toMatchObject<ViewModel>({
      isDeleting: false,
      isMutating: false,
      isProcessing: false,
      isSaving: false,
      totalCountFetched: 200,
    });
    expect(ivm2()).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});
    expect(ivm3()).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});

    coll.deleteMany({
      request: signal('ok'),
      items: [item3, item4],
    }).subscribe();

    expect(coll.itemsSignal()).toStrictEqual([item1, item2, item5, item6, item7, item8, item9]);
    expect(coll.deletingItemsSignal()).toStrictEqual([]);
    expect(vm()).toMatchObject<ViewModel>({isDeleting: false, isMutating: false, isProcessing: false, isSaving: false});
    expect(ivm2()).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});
    expect(ivm3()).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});

    coll.deleteMany({
      request: signal('ok'),
      items: [item5],
      decrementTotalCount: 110,
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      totalCountFetched: 90,
    });

    coll.deleteMany({
      request: signal('ok'),
      items: [item6, item7],
      decrementTotalCount: true,
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      totalCountFetched: 88,
    });

    coll.deleteMany({
      request: signal({total: 10}),
      items: [item8],
      decrementTotalCount: 'total',
    }).subscribe();

    expect(vm()).toMatchObject<ViewModel>({
      totalCountFetched: 10,
    });
  });

  it('status', () => {
    const {coll} = setup();
    const vm = coll.getViewModelSignal();

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};

    // here `computed()` is used just to check if returned signal can be used inside the `computed()`
    const ivm = computed(() => coll.getItemViewModelSignal(signal(item1)))();

    coll.read({request: signal([item1, item2])}).subscribe();
    expect(coll.itemsSignal()).toStrictEqual([item1, item2]);

    expect(vm()).toMatchObject<ViewModel>({isProcessing: false});
    expect(ivm()).toMatchObject<ItemViewModel>({isProcessing: false, isUpdating: false, isRefreshing: false});
    expect(vm().statuses.get(item1)?.has('selected')).toBeFalsy();

    coll.setItemStatus(item1, 'selected');

    expect(vm()).toMatchObject<ViewModel>({isProcessing: false});
    expect(ivm()).toMatchObject<ItemViewModel>({isProcessing: false, isUpdating: false, isRefreshing: false});
    expect(vm().statuses.get(item1)?.has('selected')).toBeTruthy();

    coll.setItemStatus(item1, 'awesome');

    expect(vm().statuses.get(item1)?.has('selected')).toBeTruthy();
    expect(vm().statuses.get(item1)?.has('awesome')).toBeTruthy();

    coll.deleteItemStatus(item1, 'awesome');

    expect(vm().statuses.get(item1)?.has('selected')).toBeTruthy();
    expect(vm().statuses.get(item1)?.has('awesome')).toBeFalsy();

    coll.deleteItemStatus(item1, 'selected');

    expect(vm().statuses.get(item1)?.has('selected')).toBeFalsy();
    expect(vm().statuses.get(item1)?.has('awesome')).toBeFalsy();

    coll.setItemStatus(item1, 'awesome');

    expect(vm().statuses.get(item1)?.has('awesome')).toBeTruthy();
  });

  it('unique status', () => {
    const {coll, vm} = setup();

    const item1 = {id: -1, name: '#!'};
    const item2 = {id: 0, name: '!@'};

    coll.read({request: signal([item1, item2])}).subscribe();
    expect(coll.itemsSignal()).toStrictEqual([item1, item2]);

    expect(vm().status.get('focused')).toBeFalsy();

    coll.setUniqueStatus('focused', item2);
    coll.setUniqueStatus('reserved', item2);

    expect(vm().status.get('focused')).toStrictEqual(item2);

    coll.setUniqueStatus('chosen', item1);

    expect(vm().status.get('focused')).toStrictEqual(item2);
    expect(vm().status.get('chosen')).toStrictEqual(item1);
    expect(vm().status.get('reserved')).toStrictEqual(item2);

    coll.setUniqueStatus('chosen', item2, false);

    expect(vm().status.get('chosen')).toStrictEqual(item1);

    coll.setUniqueStatus('chosen', item1, false);

    expect(vm().status.get('chosen')).toBeFalsy();

    coll.deleteUniqueStatus('focused');

    expect(vm().status.get('focused')).toBeFalsy();
    expect(vm().status.get('chosen')).toBeFalsy();

    expect(vm().status.get('reserved')).toStrictEqual(item2);
    coll.setUniqueStatus('reserved', item1);
    expect(vm().status.get('reserved')).toStrictEqual(item1);
  });

  it('getItem', () => {
    const {coll} = setup();

    expect(coll.getItemSignal({id: 1})()).toStrictEqual(undefined);

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};
    const item3 = {id: 3, name: 'C'};

    coll.read({
      request: signal([item1, item2, item3])
    }).subscribe();

    expect(coll.getItemSignal({id: 1})()).toStrictEqual(item1);

    const itemSource = coll.getItemSignal(signal(item2));

    expect(itemSource()).toStrictEqual(item2);
  });

  it('getItemByField', () => {
    const {coll} = setup();

    expect(coll.getItemByFieldSignal('id', 1)()).toStrictEqual(undefined);

    const item1 = {id: 0, name: '!'};
    const item2 = {id: -1, name: '?'};
    const item3 = {id: 1, name: '*'};

    coll.read({
      request: signal([item1, item2, item3])
    }).subscribe();

    expect(coll.getItemByFieldSignal('id', 0)()).toStrictEqual(item1);
    expect(coll.getItemByFieldSignal(['id', 'name'], -1)()).toStrictEqual(item2);
    expect(coll.getItemByFieldSignal(['id', 'name'], '*')()).toStrictEqual(item3);

    const itemSource = coll.getItemByFieldSignal('id', signal(0));

    expect(itemSource()).toStrictEqual(item1);
  });

  it('custom comparator fn with multiple fields', () => {
    const coll = new CollectionService<Item>({
      comparator: (item1: Item, item2: Item) => (item1.id + item1.name) === (item2.id + item2.name),
      allowFetchedDuplicates: false,
      onDuplicateErrCallbackParam: 'DRY',
      throwOnDuplicates: false
    }, TestBed.inject(Injector));

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};
    const item3 = {id: 1, name: 'B'};
    const item4 = {id: 2, name: 'B'};

    let errMsg = '';

    coll.read({
      request: signal([item1, item2, item3, item4]),
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

    expect(lastEmitted).toBeFalsy();

    coll.create({
      request: signal({id: 1, name: 'A'})
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}]);
  });

  it('should emit onCreate for createMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForCreate().subscribe(v => lastEmitted = v);

    expect(lastEmitted).toBeFalsy();

    coll.createMany({
      request: signal([{id: 1, name: 'A'}, {id: 2, name: 'B'}])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);
  });

  it('should not emit onCreate without subscribers', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    const s = coll.listenForCreate().subscribe(v => lastEmitted = v);

    expect(lastEmitted).toBeFalsy();
    s.unsubscribe();

    coll.create({
      request: signal({id: 1, name: 'A'})
    }).subscribe();

    expect(lastEmitted).toStrictEqual(undefined);
  });

  it('should emit onRead', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe(v => lastEmitted = v);

    expect(lastEmitted).toBeFalsy();

    coll.read({
      request: signal([{id: 1, name: 'A'}])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}]);
  });

  it('should emit onRead for readMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe(v => lastEmitted = v);

    expect(lastEmitted).toBeFalsy();

    coll.readMany({
      request: signal([{id: 1, name: 'A'}, {id: 2, name: 'B'}])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);
  });

  it('should emit onRead for refresh', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe(v => lastEmitted = v);

    coll.read({
      request: signal([{id: 1, name: 'A'}])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}]);

    coll.refresh({
      request: signal({id: 1, name: 'B'}),
      item: {id: 1},
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'B'}]);
  });

  it('should emit onRead for refreshMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe(v => lastEmitted = v);

    coll.read({
      request: signal([{id: 1, name: 'A'}, {id: 2, name: 'B'}])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);

    coll.refreshMany({
      request: signal([{id: 1, name: 'C'}, {id: 2, name: 'D'}]),
      items: [{id: 1}, {id: 2}],
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'C'}, {id: 2, name: 'D'}]);
  });

  it('should emit onUpdate', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForUpdate().subscribe(v => lastEmitted = v);

    coll.read({
      request: signal([{id: 1, name: 'A'}])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();

    coll.update({
      request: signal({id: 1, name: 'B'}),
      item: {id: 1},
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'B'}]);
  });

  it('should emit onUpdate for updateMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForUpdate().subscribe(v => lastEmitted = v);

    coll.read({
      request: signal([{id: 1, name: 'A'}])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();

    coll.updateMany({
      request: signal([{id: 1, name: 'B'}, {id: 2, name: 'A'}]),
      items: [{id: 1}, {id: 2}],
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1, name: 'B'}, {id: 2, name: 'A'}]);
  });

  it('should emit onDelete', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForDelete().subscribe(v => lastEmitted = v);

    coll.read({
      request: signal([{id: 1, name: 'A'}])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();

    coll.delete({
      request: signal(null),
      item: {id: 1}
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1}]);
  });

  it('should emit onDelete for deleteMany', () => {
    const {coll} = setup();
    let lastEmitted: any = undefined;
    coll.listenForDelete().subscribe(v => lastEmitted = v);

    coll.read({
      request: signal([{id: 1, name: 'A'}, {id: 2, name: 'B'}])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();

    coll.deleteMany({
      request: signal(null),
      items: [{id: 1}, {id: 2}]
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{id: 1}, {id: 2}]);
  });
});
