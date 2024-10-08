import { signal } from '@angular/core';
import { Collection } from '../collection';

type Item = {
  id: number;
  name: string;
}

function setup() {
  const coll = new Collection<Item>({
    throwOnDuplicates: 'duplicate',
    comparatorFields: ['id']
  });

  return {
    coll,
  };
}

describe('Collection Service (sync)', () => {
  it('create', () => {
    const { coll } = setup();
    const newItem: Item = { id: 0, name: ':)' };

    coll.create({
      request: signal(newItem)
    }).subscribe();

    expect(coll.$items()).toStrictEqual([newItem]);

    const secondItem: Item = { id: -1, name: ';)' };

    coll.create({
      request: signal(secondItem)
    }).subscribe();

    expect(coll.$items()).toStrictEqual([newItem, secondItem]);

    coll.create({
      request: signal(secondItem)
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
      request: signal([item1])
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1]);

    coll.createMany({
      request: signal([item2, item3]),
    }).subscribe();

    // should not mutate - item5 is a duplicate of item4
    coll.createMany({
      request: [signal(item4), signal(item5)],
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3]);

    coll.createMany({
      request: [signal(item4), signal(item6)],
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item4, item6]);

    coll.createMany({
      request: signal({ items: [item7], totalCount: 0 }),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item4, item6, item7]);

    expect(coll.$totalCountFetched()).toStrictEqual(0);

    coll.createMany({
      request: signal({ items: [], totalCount: 4815162342 }),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item4, item6, item7]);

    expect(coll.$totalCountFetched()).toStrictEqual(4815162342);
  });

  it('read', () => {
    const { coll } = setup();

    expect(coll.$isBeforeFirstRead()).toBeTruthy();

    coll.read({
      request: signal([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]),
    }).subscribe();

    expect(coll.$isBeforeFirstRead()).toBeFalsy();
    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);

    coll.read({
      request: signal({ items: [{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }], totalCount: 12 })
    }).subscribe();

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }]);
    expect(coll.$totalCountFetched()).toStrictEqual(12);

    coll.setAllowFetchedDuplicates(false);
    coll.setThrowOnDuplicates(undefined);

    coll.read({
      request: signal({ items: [{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }, { id: 2, name: 'BNX' }], totalCount: 10000 }),
      keepExistingOnError: true,
    }).subscribe();

    expect(coll.$items()).toStrictEqual([{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }]);
    expect(coll.$totalCountFetched()).toStrictEqual(12);

    coll.read({
      request: signal({ items: [{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }, { id: 2, name: 'BNX' }], totalCount: 10000 }),
      keepExistingOnError: false,
    }).subscribe();

    expect(coll.$items()).toStrictEqual([]);
    expect(coll.$totalCountFetched()).toStrictEqual(undefined);

    coll.read({
      request: signal({ items: [{ id: 1, name: 'AN' }, { id: 2, name: 'BN' }, { id: 2, name: 'BNX' }] })
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

    coll.read({ request: signal([item1, item2, item3]) }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3]);

    coll.readOne({
      request: signal(item),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item]);

    coll.readOne({
      request: signal(item3v2),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3v2, item]);
  });

  it('read many', () => {
    const { coll } = setup();
    const items: Item[] = [{ id: 0, name: 'A' }, { id: 1, name: 'B' }, { id: 2, name: 'C' }];
    const newItems: Item[] = [{ id: 3, name: 'D' }, { id: 4, name: 'E' }];
    const newItemsV2 = { items: [{ id: 3, name: 'D!' }, { id: 4, name: 'E!' }], totalCount: 4815162342 };

    coll.read({ request: signal(items) }).subscribe();

    expect(coll.$items()).toStrictEqual(items);

    coll.readMany({
      request: signal(newItems),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([...items, ...newItems]);

    coll.readMany({
      request: signal(newItemsV2),
    }).subscribe();

    expect(coll.$items()).toStrictEqual([...items, ...newItemsV2.items]);
    expect(coll.$totalCountFetched()).toStrictEqual(4815162342);
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

    coll.read({ request: signal([item1, item2]) }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2]);

    coll.refresh({
      request: signal(item2f),
      item: item2
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2f]);

    coll.refreshMany({
      request: signal([item1f, item3]),
      items: [item1]
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1f, item2f, item3]);

    coll.refreshMany({
      request: [signal(item3f), signal(item4)],
      items: [item3]
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1f, item2f, item3f, item4]);

    coll.refreshMany({
      request: signal({ items: [item2f, item3f, item4f], totalCount: 4815162342 }),
      items: [item3f, item4]
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1f, item2f, item3f, item4f]);
    expect(coll.$totalCountFetched()).toStrictEqual(4815162342);
  });

  it('update', () => {
    const { coll } = setup();

    const item1 = { id: -1, name: 'A' };
    const item2 = { id: 0, name: 'B' };

    const iSignal = signal(item2);

    expect(coll.isItemUpdating(iSignal)()).toStrictEqual(false);
    expect(coll.isItemProcessing(iSignal)()).toStrictEqual(false);
    expect(coll.isItemMutating(iSignal)()).toStrictEqual(false);

    coll.read({
      request: signal([item1, item2])
    }).subscribe();

    const newItem2 = { id: 0, name: 'C' };

    coll.update({
      request: signal(newItem2),
      item: item2,
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, newItem2]);
  });

  it('update many', () => {
    const { coll } = setup();

    const item1 = { id: -1, name: 'A' };
    const item2 = { id: 0, name: 'B' };
    const item3 = { id: 1, name: 'C' };
    const item4 = { id: 2, name: 'D' };

    coll.read({
      request: signal([item1, item2, item3, item4])
    }).subscribe();

    const newItem2 = { id: 0, name: 'X' };
    const newItem4 = { id: 2, name: 'Y' };

    coll.updateMany({
      request: signal([newItem2, newItem4]),
      items: [item2, item4],
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, newItem2, item3, newItem4]);
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

    expect(coll.$items()).toStrictEqual([
      item1,
      item2,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.$totalCountFetched()).toStrictEqual(7);

    coll.delete({
      request: signal(item2),
      item: item2,
    }).subscribe();

    expect(coll.$items()).toStrictEqual([
      item1,
      item3,
      item4,
      item5,
      item6,
      item7,
    ]);
    expect(coll.$totalCountFetched()).toStrictEqual(7);

    coll.delete({
      request: signal(null),
      item: item3,
      decrementTotalCount: 3,
    }).subscribe();

    expect(coll.$totalCountFetched()).toStrictEqual(4);

    coll.delete({
      request: signal(null),
      item: item4,
      decrementTotalCount: true,
    }).subscribe();

    expect(coll.$totalCountFetched()).toStrictEqual(3);

    coll.delete({
      request: signal({ totalItems: 1 }),
      item: item5,
      decrementTotalCount: 'totalItems',
    }).subscribe();

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
      request: signal({
        items: [item1, item2, item3, item4, item5, item6, item7, item8, item9],
        totalCount: 200
      })
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item3, item4, item5, item6, item7, item8, item9]);
    expect(coll.$totalCountFetched()).toStrictEqual(200);

    coll.deleteMany({
      request: signal('ok'),
      items: [item3, item4],
    }).subscribe();

    expect(coll.$items()).toStrictEqual([item1, item2, item5, item6, item7, item8, item9]);

    coll.deleteMany({
      request: signal('ok'),
      items: [item5],
      decrementTotalCount: 110,
    }).subscribe();

    expect(coll.$totalCountFetched()).toStrictEqual(90);

    coll.deleteMany({
      request: signal('ok'),
      items: [item6, item7],
      decrementTotalCount: true,
    }).subscribe();

    expect(coll.$totalCountFetched()).toStrictEqual(88);

    coll.deleteMany({
      request: signal({ total: 10 }),
      items: [item8],
      decrementTotalCount: 'total',
    }).subscribe();

    expect(coll.$totalCountFetched()).toStrictEqual(10);
  });

  it('status', () => {
    const { coll } = setup();

    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };

    coll.read({ request: signal([item1, item2]) }).subscribe();
    expect(coll.$items()).toStrictEqual([item1, item2]);

    expect(coll.$statuses().get(item1)?.has('selected')).toBeFalsy();

    coll.setItemStatus(item1, 'selected');

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

    coll.read({ request: signal([item1, item2]) }).subscribe();
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
      request: signal([item1, item2, item3])
    }).subscribe();

    expect(coll.getItem({ id: 1 })()).toStrictEqual(item1);

    const itemSource = coll.getItem(signal(item2));

    expect(itemSource()).toStrictEqual(item2);
  });

  it('getItemByField', () => {
    const { coll } = setup();

    expect(coll.getItemByField('id', 1)()).toStrictEqual(undefined);

    const item1 = { id: 0, name: '!' };
    const item2 = { id: -1, name: '?' };
    const item3 = { id: 1, name: '*' };

    coll.read({
      request: signal([item1, item2, item3])
    }).subscribe();

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
      request: signal([item1, item2, item3, item4]),
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

    expect(lastEmitted).toBeFalsy();

    coll.create({
      request: signal({ id: 1, name: 'A' })
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('should emit onCreate for createMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForCreate().subscribe((v: any) => lastEmitted = v);

    expect(lastEmitted).toBeFalsy();

    coll.createMany({
      request: signal([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  });

  it('should not emit onCreate without subscribers', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    const s = coll.listenForCreate().subscribe((v: any) => lastEmitted = v);

    expect(lastEmitted).toBeFalsy();
    s.unsubscribe();

    coll.create({
      request: signal({ id: 1, name: 'A' })
    }).subscribe();

    expect(lastEmitted).toStrictEqual(undefined);
  });

  it('should emit onRead', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    expect(lastEmitted).toBeFalsy();

    coll.read({
      request: signal([{ id: 1, name: 'A' }])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }]);
  });

  it('should emit onRead for readMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    expect(lastEmitted).toBeFalsy();

    coll.readMany({
      request: signal([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  });

  it('should emit onRead for refresh', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: signal([{ id: 1, name: 'A' }])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }]);

    coll.refresh({
      request: signal({ id: 1, name: 'B' }),
      item: { id: 1 },
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'B' }]);
  });

  it('should emit onRead for refreshMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForRead().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: signal([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);

    coll.refreshMany({
      request: signal([{ id: 1, name: 'C' }, { id: 2, name: 'D' }]),
      items: [{ id: 1 }, { id: 2 }],
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'C' }, { id: 2, name: 'D' }]);
  });

  it('should emit onUpdate', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForUpdate().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: signal([{ id: 1, name: 'A' }])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();

    coll.update({
      request: signal({ id: 1, name: 'B' }),
      item: { id: 1 },
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'B' }]);
  });

  it('should emit onUpdate for updateMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForUpdate().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: signal([{ id: 1, name: 'A' }])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();

    coll.updateMany({
      request: signal([{ id: 1, name: 'B' }, { id: 2, name: 'A' }]),
      items: [{ id: 1 }, { id: 2 }],
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1, name: 'B' }, { id: 2, name: 'A' }]);
  });

  it('should emit onDelete', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForDelete().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: signal([{ id: 1, name: 'A' }])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();

    coll.delete({
      request: signal(null),
      item: { id: 1 }
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1 }]);
  });

  it('should emit onDelete for deleteMany', () => {
    const { coll } = setup();
    let lastEmitted: any = undefined;
    coll.listenForDelete().subscribe((v: any) => lastEmitted = v);

    coll.read({
      request: signal([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    }).subscribe();

    expect(lastEmitted).toBeFalsy();

    coll.deleteMany({
      request: signal(null),
      items: [{ id: 1 }, { id: 2 }]
    }).subscribe();

    expect(lastEmitted).toStrictEqual([{ id: 1 }, { id: 2 }]);
  });

  it('getDuplicates', () => {
    class CollectionTest extends Collection<any> {
      public override hasDuplicates(items: any[]) {
        return super.hasDuplicates(items);
      }
    }

    const m = new CollectionTest();

    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };
    const item3 = { id: 3, name: 'C' };
    const item2d = { id: 1, name: '!A' };

    expect(m.getDuplicates([item1, item2, item3])).toStrictEqual(null);

    const expected = new Map();
    expected.set(1, { 1: item2, 3: item2d });
    expect(m.getDuplicates([item1, item2, item3, item2d])).toMatchObject(expected);

    m.setComparator((a: unknown, b: unknown) => a === b);

    expect(m.hasDuplicates(
      [0, 1, 2, 3, 4, 5, 2]
    )).toStrictEqual(2);
    expect(m.hasDuplicates(
      [0, 0, 2, 3, 4, 5, 2]
    )).toStrictEqual(0);
    expect(m.hasDuplicates(
      [0, 1, 1, 3, 4, 5, 2]
    )).toStrictEqual(1);
    expect(m.hasDuplicates(
      [0, 1, 2, 3, 4, 5, 5]
    )).toStrictEqual(5);
    expect(m.hasDuplicates(
      [0, 1, 2, 3, 2, 4, 5]
    )).toStrictEqual(2);
  });

  it('equalItems', () => {
    class CollectionTest extends Collection<any> {
      public readonly $testingItems = signal<any[]>([], { equal: this.equalItems });
    }

    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };
    const item3 = { id: 3, name: 'C' };
    const item1d = { id: 1, name: '!A' };

    const coll = new CollectionTest({ comparatorFields: ['id'] });
    coll.$testingItems.set([item1, item2]);
    expect(coll.$testingItems()).toStrictEqual([item1, item2]);

    coll.$testingItems.set([item1d, item2]);
    expect(coll.$testingItems()).toStrictEqual([item1, item2]);

    coll.$testingItems.set([item1, item3]);
    expect(coll.$testingItems()).toStrictEqual([item1, item3]);
  });

  it('should call first read handler', (done) => {
    const item1 = { id: 1, name: 'A' };
    const item2 = { id: 2, name: 'B' };
    const item3 = { id: 3, name: 'C' };

    const { coll } = setup();

    let handlerWasCalled = false;

    coll.setOnFirstItemsRequest(() => {
      handlerWasCalled = true;
      coll.read({
        request: signal([item1, item2, item3])
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

  it('should convert list of ids to list of partial items', () => {
    const { coll } = setup();

    expect(coll.idsToPartialItems([1, 2, 3], 'id')).toStrictEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });
});
