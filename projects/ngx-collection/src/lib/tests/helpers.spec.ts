import { equalPrimitives, getObjectPathValue, isEmptyObject, isEmptyValue } from '../helpers';

describe('getObjectPathValue', () => {
  it('should return undefined if path is empty', () => {
    expect(getObjectPathValue({}, '')).toBe(undefined);
  });

  it('should return undefined if path is not in object', () => {
    const object = { foo: { bar: { baz: 'qux' } } };
    expect(getObjectPathValue(object, 'foo.quux')).toBe(undefined);
    expect(getObjectPathValue(object, 'foo.bar.quux')).toBe(undefined);
    expect(getObjectPathValue(object, 'foo.bar.baz.quux')).toBe(undefined);
  });

  it('should return value of path in object', () => {
    const object = { foo: { bar: { baz: 'qux' } } };
    expect(getObjectPathValue(object, 'foo')).toEqual({ bar: { baz: 'qux' } });
    expect(getObjectPathValue(object, 'foo.bar')).toEqual({ baz: 'qux' });
    expect(getObjectPathValue(object, 'foo.bar.baz')).toEqual('qux');
  });

  it('should return value of path in object even if recursion limit is exceeded', () => {
    const object = { foo: { bar: { baz: { qux: 'quux' } } } };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {
    });

    expect(getObjectPathValue(object, 'foo.bar.baz.qux', 97)).toBe('quux');

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it('should return undefined for null object input', () => {
    expect(getObjectPathValue(null as any, 'foo')).toBe(undefined);
    expect(getObjectPathValue(undefined as any, 'foo')).toBe(undefined);
  });

  it('should return undefined for null object input with dotted path', () => {
    expect(getObjectPathValue(null as any, 'foo.bar')).toBe(undefined);
  });
});

describe('isEmptyValue()', () => {
  it('should return true for undefined values', () => {
    expect(isEmptyValue(undefined)).toBe(true);
  });

  it('should return true for null values', () => {
    expect(isEmptyValue(null)).toBe(true);
  });

  it('should return true for NaN values', () => {
    expect(isEmptyValue(NaN)).toBe(true);
  });

  it('should return false for 0 values', () => {
    expect(isEmptyValue(0)).toBe(false);
  });

  it('should return false for "0" values', () => {
    expect(isEmptyValue('0')).toBe(false);
  });

  it('should return false for "false" values', () => {
    expect(isEmptyValue('false')).toBe(false);
  });

  it('should return false for false boolean values', () => {
    expect(isEmptyValue(false)).toBe(false);
  });

  it('should return true for empty arrays', () => {
    expect(isEmptyValue([])).toBe(true);
  });

  it('should return true for arrays with one empty object', () => {
    expect(isEmptyValue([{}])).toBe(true);
  });

  it('should return true for empty string', () => {
    expect(isEmptyValue('')).toBe(true);
  });

  it('should return false for non-empty string', () => {
    expect(isEmptyValue('hello')).toBe(false);
  });

  it('should return false for non-array objects', () => {
    expect(isEmptyValue({})).toBe(false);
    expect(isEmptyValue({ a: 1 })).toBe(false);
  });

  it('should return false for non-empty arrays', () => {
    expect(isEmptyValue([1])).toBe(false);
    expect(isEmptyValue([1, 2])).toBe(false);
  });
});

describe('isEmptyObject()', () => {
  it('should return true for undefined values', () => {
    expect(isEmptyObject(undefined)).toBe(true);
  });

  it('should return true for null values', () => {
    expect(isEmptyObject(null)).toBe(true);
  });

  it('should return true for NaN values', () => {
    expect(isEmptyObject(NaN)).toBe(true);
  });

  it('should return true for objects with no own properties', () => {
    expect(isEmptyObject({})).toBe(true);
  });

  it('should return false for objects with inherited properties', () => {
    class Base {
      a: string = 'a';
    }

    class Derived extends Base {
    }

    const obj = new Derived();
    expect(isEmptyObject(obj)).toBe(false);
  });

  it('should return false for objects with own properties', () => {
    expect(isEmptyObject({ foo: 'bar' })).toBe(false);
  });

  it('should return true for arrays with no elements', () => {
    expect(isEmptyObject([])).toBe(true);
  });

  it('should return false for arrays with only empty objects', () => {
    expect(isEmptyObject([{}, {}])).toBe(false);
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
    const str1 = '1';
    expect(equalPrimitives(str1, str1)).toBe(true);
    const str2 = '1';
    expect(equalPrimitives(str1, str2)).toBe(true);
    const arr1 = ['a'];
    expect(equalPrimitives(arr1, arr1)).toBe(false);
    const arr2 = arr1.slice();
    expect(equalPrimitives(arr1, arr2)).toBe(false);
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
