import { CollectionManager } from '../collection.manager';

describe('CollectionManager', () => {
  it('getDuplicates', () => {
    const m = new CollectionManager();

    const item1 = {id: 1, name: 'A'};
    const item2 = {id: 2, name: 'B'};
    const item3 = {id: 3, name: 'C'};
    const item2d = {id: 1, name: '!A'};

    expect(m.getDuplicates([item1, item2, item3])).toStrictEqual(null);

    const expected = new Map();
    expected.set(1, {1: item2, 3: item2d});
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
});