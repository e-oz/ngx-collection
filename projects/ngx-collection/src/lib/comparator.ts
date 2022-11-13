import { isEmptyObject, isEmptyValue } from './helpers';

export interface ObjectsComparator {
  equal: (obj1: unknown, obj2: unknown) => boolean;
}

export class Comparator implements ObjectsComparator {
  constructor(private fields: string[] = ['uuId']) {}

  equal(obj1: unknown, obj2: unknown, byField?: string): boolean {
    if (obj1 === obj2) {
      return true;
    }
    if (obj1 == null || obj1 !== obj1 || obj2 == null || obj2 !== obj2 || (typeof obj1 !== 'object') || (typeof obj2 !== 'object')) {
      return false;
    }
    const fields = byField ? [byField] : this.fields;
    if (fields.length) {
      for (const field of fields) {
        if (obj1.hasOwnProperty(field) && obj2.hasOwnProperty(field)) {
          if (!isEmptyValue((obj1 as any)[field])
            && !isEmptyValue((obj2 as any)[field])
            && !isEmptyObject((obj1 as any)[field])
            && !isEmptyObject((obj2 as any)[field])
            && (obj1 as any)[field] === (obj2 as any)[field]
          ) {
            return true;
          } else {
            // stop the chain on the first found pair of existing fields
            return false;
          }
        }
      }
    }
    return false;
  }
}
