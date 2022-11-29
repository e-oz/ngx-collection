import { isEmptyObject, isEmptyValue } from './helpers';

export type ObjectsComparatorFn<T = any> = (obj1: T, obj2: T) => boolean;

export interface ObjectsComparator {
  equal: ObjectsComparatorFn;
}

export class Comparator implements ObjectsComparator {
  constructor(private fields: (string | string[])[] = ['uuId', 'id']) {}

  equal(obj1: unknown, obj2: unknown, byFields?: (string | string[])[]): boolean {
    if (obj1 === obj2) {
      return true;
    }
    if (obj1 == null || obj1 !== obj1 || obj2 == null || obj2 !== obj2 || (typeof obj1 !== 'object') || (typeof obj2 !== 'object')) {
      return false;
    }
    const fields = byFields?.length ? byFields : this.fields;
    if (fields.length) {
      for (const field of fields) {
        if (typeof field === 'string') {
          if (obj1.hasOwnProperty(field) && obj2.hasOwnProperty(field)) {
            if (fieldValuesAreNotEmptyAndEqual(obj1, obj2, field)) {
              return true;
            } else {
              // stop the chain on the first found pair of existing fields
              return false;
            }
          }
        } else {
          if (!field.find(key =>
            !obj1.hasOwnProperty(key)
            || !obj2.hasOwnProperty(key)
            || !fieldValuesAreNotEmptyAndEqual(obj1, obj2, key))
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

function fieldValuesAreNotEmptyAndEqual(obj1: unknown, obj2: unknown, field: string): boolean {
  return (!isEmptyValue((obj1 as any)[field])
    && !isEmptyValue((obj2 as any)[field])
    && !isEmptyObject((obj1 as any)[field])
    && !isEmptyObject((obj2 as any)[field])
    && (obj1 as any)[field] === (obj2 as any)[field]
  );
}
