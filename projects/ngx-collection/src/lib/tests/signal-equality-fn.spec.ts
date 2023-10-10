import { equalArrays, equalMaps, equalObjects, equalPrimitives, equalSets } from "../signal-equality-fn";

describe('equalArrays', () => {
  it('returns true for equal arrays', () => {
    expect(equalArrays([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(equalArrays([1, new Set(), 3], [1, new Set(), 3])).toBe(true);
    expect(equalArrays([1, 2, null], [1, 2, null])).toBe(true);
    expect(equalArrays([1, 2, null], [1, 2, undefined])).toBe(true);
    expect(equalArrays([], [])).toBe(true);
    expect(equalArrays([[]], [[]])).toBe(true);
  });

  it('returns false for non-equal arrays', () => {
    expect(equalArrays([1, 2, 3], [1, 2])).toBe(false);
    expect(equalArrays([1, 2], [1, 2, 3])).toBe(false);
    expect(equalArrays([1, 2, 3], [3, 2, 1])).toBe(false);
    expect(equalArrays([1, 2, { a: 3 }], [1, 2, { a: 3 }])).toBe(false);
    expect(equalArrays([[[]]], [[[]]])).toBe(false);
    expect(equalArrays([1, new Set(), 3], [1, new Map() as any, 3])).toBe(false);
    expect(equalArrays([1, 2, null], [1, 2, 0])).toBe(false);
  });

  it('returns false for non-array inputs', () => {
    expect(equalArrays([], null as any)).toBe(false);
    expect(equalArrays(null as any, [])).toBe(false);
    expect(equalArrays(null as any, null as any)).toBe(true);
    expect(equalArrays(undefined as any, undefined as any)).toBe(true);
    expect(equalArrays({} as any, [])).toBe(false);
    expect(equalArrays([], {} as any)).toBe(false);
    expect(equalArrays('' as any, [])).toBe(false);
    expect(equalArrays([], '' as any)).toBe(false);
  });
});

describe('equalMaps', () => {
  it('returns true for equal maps', () => {
    const map1 = new Map<number, string>([[1, 'one'], [2, 'two'], [3, 'three']]);
    const map2 = new Map<number, string>([[1, 'one'], [2, 'two'], [3, 'three']]);
    expect(equalMaps(map1, map2)).toBe(true);
    expect(equalMaps(map1, map1)).toBe(true);

    expect(equalMaps(
      new Map([['a', 1], ['b', 2], ['c', null]]),
      new Map([['a', 1], ['b', 2], ['c', undefined]])
    )).toBe(true);

    expect(equalMaps(
      new Map([['a', []], ['b', []], ['c', []]]),
      new Map([['a', []], ['b', []], ['c', []]])
    )).toBe(true);

    expect(equalMaps(
      new Map([['a', new Map()], ['b', new Map()]]),
      new Map([['a', new Map()], ['b', new Map()]]),
    )).toBe(true);

    expect(equalMaps(
      new Map([['a', new Set()], ['b', new Set()]]),
      new Map([['a', new Set()], ['b', new Set()]]),
    )).toBe(true);
  });

  it('returns false for non-equal maps', () => {
    const map1 = new Map<number, string>([[1, 'one'], [2, 'two'], [3, 'three']]);
    const map2 = new Map<number, string>([[1, 'one'], [2, 'two'], [4, 'four']]);
    expect(equalMaps(map1, map2)).toBe(false);

    expect(equalMaps(
      new Map([['a', []], ['b', []], ['c', []]]),
      new Map([['a', []], ['b', []], ['c', [1, 2]]])
    )).toBe(false);

    expect(equalMaps(
      new Map([['a', new Map()], ['b', new Map()]]),
      new Map([['a', new Map()], ['b', new Set() as any]]),
    )).toBe(false);

    expect(equalMaps(
      new Map([['a', new Set()], ['b', new Set()]]),
      new Map([['a', new Set()], ['b', {} as any]]),
    )).toBe(false);

  });

  it('returns false for non-map inputs', () => {
    expect(equalMaps(null as any, null as any)).toBe(true);
    expect(equalMaps(undefined as any, undefined as any)).toBe(true);
    expect(equalMaps({} as any, new Map())).toBe(false);
    expect(equalMaps(new Map(), {} as any)).toBe(false);
    expect(equalMaps('' as any, new Map())).toBe(false);
    expect(equalMaps(new Map(), '' as any)).toBe(false);
  });
});

describe('equalSets', () => {
  it('returns true for equal sets', () => {
    const set1 = new Set([1, 2, 3]);
    const set2 = new Set([1, 2, 3]);
    expect(equalSets(set1, set2)).toBe(true);
  });

  it('returns false for non-equal sets', () => {
    const set1 = new Set([1, 2, 3]);
    const set2 = new Set([1, 2, 4]);
    expect(equalSets(set1, set2)).toBe(false);
  });

  it('returns false for non-set inputs', () => {
    expect(equalSets(null as any, null as any)).toBe(true);
    expect(equalSets(undefined as any, undefined as any)).toBe(true);
    expect(equalSets({} as any, new Set())).toBe(false);
    expect(equalSets(new Set(), {} as any)).toBe(false);
    expect(equalSets('' as any, new Set())).toBe(false);
    expect(equalSets(new Set(), '' as any)).toBe(false);
  });
});

describe('equalObjects', () => {
  it('returns true for equal objects', () => {
    const b = { c: [1, 2, 3] };
    const obj1 = { a: 1, b };
    const obj2 = { a: 1, b };
    expect(equalObjects(obj1, obj2)).toBe(true);
  });

  it('returns true for ref equal objects', () => {
    const b = { c: [1, 2, 3] };
    expect(equalObjects(b, b)).toBe(true);
  });

  it('returns false for non-equal objects', () => {
    const b = { c: [1, 2, 3] };
    const obj1 = { a: 1, b: b };
    const obj2 = { a: 1, b: { c: [1, 2, 3] } };
    expect(equalObjects(obj1, obj2)).toBe(false);
  });

  it('returns false for non-object inputs', () => {
    expect(equalObjects(null, null)).toBe(true);
    expect(equalObjects(undefined, undefined)).toBe(true);
    expect(equalObjects([], {})).toBe(false);
    expect(equalObjects({}, [])).toBe(false);
    expect(equalObjects('', {} as any)).toBe(false);
    expect(equalObjects({} as any, '')).toBe(false);
  });
});

describe('equalPrimitives', () => {
  it('returns false for non-primitives', () => {
    expect(equalPrimitives(1, 0)).toBe(false);
    const symbN = Symbol('test');
    const symbM = symbN;
    const symbR = Symbol('test');
    expect(equalPrimitives(symbN, symbM)).toBe(true);
    expect(equalPrimitives(symbM, symbN)).toBe(true);
    expect(equalPrimitives(symbM, symbM)).toBe(true);
    expect(equalPrimitives(symbM, symbR)).toBe(false);
    expect(equalPrimitives(symbR, symbM)).toBe(false);
    expect(equalPrimitives('1', '1')).toBe(true);
    expect(equalPrimitives('1', '1a')).toBe(false);
    expect(equalPrimitives('1a', '1')).toBe(false);
    expect(equalPrimitives(1, '1' as any)).toBe(false);
    expect(equalPrimitives(undefined, 1)).toBe(false);
    expect(equalPrimitives(undefined, '1')).toBe(false);
    expect(equalPrimitives(1, undefined)).toBe(false);
    expect(equalPrimitives(1, null)).toBe(false);
    expect(equalPrimitives(null, 1)).toBe(false);
    expect(equalPrimitives(null, '1')).toBe(false);
    expect(equalPrimitives(null, undefined)).toBe(false);
    expect(equalPrimitives(undefined, null)).toBe(false);
    expect(equalPrimitives(undefined, undefined)).toBe(true);
    expect(equalPrimitives(null, null)).toBe(true);
    expect(equalPrimitives(NaN, NaN)).toBe(true);
    expect(equalPrimitives(0, 0)).toBe(true);
    expect(equalPrimitives(false, false)).toBe(true);
    expect(equalPrimitives(+0, -0)).toBe(false);
    expect(equalPrimitives(-0, +0)).toBe(false);
    expect(equalPrimitives(-0, -0)).toBe(true);
    expect(equalPrimitives(-0, false as any)).toBe(false);
    expect(equalPrimitives(false as any, -0)).toBe(false);
    expect(equalPrimitives(false as any, undefined)).toBe(false);
    expect(equalPrimitives(false as any, null)).toBe(false);
    expect(equalPrimitives(undefined, false as any)).toBe(false);
    expect(equalPrimitives(null, false as any)).toBe(false);
    expect(equalPrimitives(false, true)).toBe(false);
    expect(equalPrimitives(true, false)).toBe(false);
    expect(equalPrimitives(true, true)).toBe(true);
    expect(equalPrimitives(false, false)).toBe(true);
    expect(equalPrimitives(BigInt(9007199254740991), BigInt(9007199254740991))).toBe(true);
    expect(equalPrimitives(BigInt(9007199254740991), BigInt(9007199254740990))).toBe(false);
    expect(equalPrimitives(BigInt(9007199254740990), BigInt(9007199254740991))).toBe(false);
  });
});