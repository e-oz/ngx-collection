import { Comparator } from './comparator';

describe('comparator', () => {
  it('single field', () => {
    const c = new Comparator(['id']);

    expect(c.equal(
      {id: 0, name: 'A'},
      {id: 0, name: 'B'},
    )).toBeTruthy();

    expect(c.equal(
      {uuId: false, name: 'A'},
      {uuId: false, name: 'B'},
      ['uuId']
    )).toBeTruthy();

    expect(c.equal(
      {uuId: null, name: 'A'},
      {uuId: 'UUID', name: 'B'},
      ['uuId']
    )).toBeFalsy();

    expect(c.equal(
      {uuId: {}, name: 'A'},
      {uuId: 'UUID', name: 'B'},
      ['uuId']
    )).toBeFalsy();

    expect(c.equal(
      {uuId: [], name: 'A'},
      {uuId: 'UUID', name: 'B'},
      ['uuId']
    )).toBeFalsy();

    expect(c.equal(
      {uuId: undefined, name: 'A'},
      {uuId: 'UUID', name: 'B'},
      ['uuId']
    )).toBeFalsy();

    expect(c.equal(
      {uuId: undefined, name: 'A'},
      {uuId: undefined, name: 'B'},
      ['uuId']
    )).toBeFalsy();

    expect(c.equal(
      {name: 'A'},
      {name: 'B'},
      ['uuId']
    )).toBeFalsy();

    expect(c.equal(
      {path: 'body/div', name: 'A'},
      {path: 'body/div', name: 'B'},
      ['path']
    )).toBeTruthy();

    expect(c.equal(
      {id: 0, name: 'A'},
      {id: 0, name: 'B'},
      [['id']]
    )).toBeTruthy();

    expect(c.equal(
      {id: 0, name: 'A'},
      {id: 0, name: 'B'},
      ['id', 'name']
    )).toBeTruthy();

    expect(c.equal(
      {id: 0, name: 'A'},
      {name: 'A'},
      ['id', 'name']
    )).toBeTruthy();

    expect(c.equal(
      {id: 0, name: 'A'},
      {id: 1, name: 'A'},
      ['id', 'name']
    )).toBeFalsy();
  });

  it('multiple fields', () => {
    const c = new Comparator([['id', 'status']]);

    expect(c.equal(
      {id: 0, name: 'A', status: 'N'},
      {id: 0, name: 'B', status: 'N'},
    )).toBeTruthy();

    expect(c.equal(
      {id: 0, name: 'A', status: 'N'},
      {id: 1, name: 'B', status: 'N'},
    )).toBeFalsy();

    expect(c.equal(
      {id: false, name: 'B', status: 'N'},
      {id: false, name: 'B', status: 'M'},
      [['id', 'name']]
    )).toBeTruthy();

    expect(c.equal(
      {id: false, name: 'B', status: 'N'},
      {id: false, name: 'B', status: 'M'},
      [['id', 'status'], ['name']]
    )).toBeTruthy();

  });

});