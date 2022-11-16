import { CollectionService } from './collection.service';
import { of, Observable, timer, map } from 'rxjs';

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

describe('Collection Service', () => {
  it('create', () => {
    const {coll, vm} = setup();
    const newItem: Item = {id: 0, name: ':)'};

    expect(readState(vm)).toMatchObject<ViewModel>({isCreating: false, isProcessing: false, isMutating: false});

    coll.create({
      request: timer(1).pipe(map(() => newItem))
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

  it('read', () => {
    const {coll, vm} = setup();

    expect(readState(vm)).toMatchObject<ViewModel>({isReading: false, isProcessing: false, isMutating: false});

    coll.read({
      request: timer(1).pipe(map(() => ([{id: 1, name: 'A'}, {id: 2, name: 'B'}])))
    }).subscribe();

    expect(readState(vm)).toMatchObject<ViewModel>({isReading: true, isProcessing: true, isMutating: false});

    jest.runOnlyPendingTimers();

    expect(readState(coll.items$)).toStrictEqual([{id: 1, name: 'A'}, {id: 2, name: 'B'}]);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}]})
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([{id: 1, name: 'AN'}, {id: 2, name: 'BN'}]);

    coll.setAllowFetchedDuplicates(false);

    coll.read({
      request: of({items: [{id: 1, name: 'AN'}, {id: 2, name: 'BN'}, {id: 2, name: 'BNX'}]})
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([]);
  });

  it('update', () => {
    const {coll, vm} = setup();

    const item1 = {id: -1, name: 'A'};
    const item2 = {id: 0, name: 'B'};

    const ivm = coll.getItemViewModel(of(item2));

    expect(readState(vm)).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false});

    coll.read({
      request: of([item1, item2])
    }).subscribe();

    const newItem2 = {id: 0, name: 'C'};

    expect(readState(vm)).toMatchObject<ViewModel>({isUpdating: false, isProcessing: false, isMutating: false});
    expect(readState(ivm)).toMatchObject({isUpdating: false, isMutating: false, isProcessing: false});
    expect(readState(coll.updatingItems$).length).toEqual(0);

    coll.update({
      request: timer(1).pipe(map(() => newItem2)),
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

  it('delete', () => {
    const {coll, vm} = setup();

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 0, name: 'B'};
    const ivm = coll.getItemViewModel(of(item2));

    coll.read({request: of([item1, item2])}).subscribe();

    expect(readState(coll.items$)).toStrictEqual([item1, item2]);
    expect(readState(coll.deletingItems$)).toStrictEqual([]);
    expect(readState(vm)).toMatchObject<ViewModel>({isDeleting: false, isMutating: false, isProcessing: false, isSaving: false});
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});

    coll.delete({
      request: timer(1).pipe(map(() => item2)),
      item: item2,
    }).subscribe();

    expect(readState(coll.items$)).toStrictEqual([item1, item2]);
    expect(readState(coll.deletingItems$)).toStrictEqual([item2]);
    expect(readState(vm)).toMatchObject<ViewModel>({isDeleting: true, isMutating: true, isProcessing: true, isSaving: false});
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isProcessing: true, isMutating: true, isDeleting: true, isRefreshing: false, isUpdating: false});

    jest.runOnlyPendingTimers();

    expect(readState(coll.items$)).toStrictEqual([item1]);
    expect(readState(coll.deletingItems$)).toStrictEqual([]);
    expect(readState(vm)).toMatchObject<ViewModel>({isDeleting: false, isMutating: false, isProcessing: false, isSaving: false});
    expect(readState(ivm)).toMatchObject<ItemViewModel>({isProcessing: false, isMutating: false, isDeleting: false, isRefreshing: false, isUpdating: false});
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
});

