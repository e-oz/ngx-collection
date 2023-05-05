import { getObjectPathValue, isEmptyObject, isEmptyValue } from './helpers';

describe('getObjectPathValue', () => {
  it('should return undefined if path is empty', () => {
    expect(getObjectPathValue({}, '')).toBe(undefined);
  });

  it('should return undefined if path is not in object', () => {
    const object = {foo: {bar: {baz: 'qux'}}};
    expect(getObjectPathValue(object, 'foo.quux')).toBe(undefined);
    expect(getObjectPathValue(object, 'foo.bar.quux')).toBe(undefined);
    expect(getObjectPathValue(object, 'foo.bar.baz.quux')).toBe(undefined);
  });

  it('should return value of path in object', () => {
    const object = {foo: {bar: {baz: 'qux'}}};
    expect(getObjectPathValue(object, 'foo')).toEqual({bar: {baz: 'qux'}});
    expect(getObjectPathValue(object, 'foo.bar')).toEqual({baz: 'qux'});
    expect(getObjectPathValue(object, 'foo.bar.baz')).toEqual('qux');
  });

  it('should return value of path in object even if recursion limit is exceeded', () => {
    const object = {foo: {bar: {baz: {qux: 'quux'}}}};
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(getObjectPathValue(object, 'foo.bar.baz.qux', 97)).toBe('quux');

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
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
    class Base {a: string = 'a';}

    class Derived extends Base {}

    const obj = new Derived();
    expect(isEmptyObject(obj)).toBe(false);
  });

  it('should return false for objects with own properties', () => {
    expect(isEmptyObject({foo: 'bar'})).toBe(false);
  });

  it('should return true for arrays with no elements', () => {
    expect(isEmptyObject([])).toBe(true);
  });

  it('should return false for arrays with only empty objects', () => {
    expect(isEmptyObject([{}, {}])).toBe(false);
  });
});

