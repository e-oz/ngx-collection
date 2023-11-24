import { getObjectPathValue, isEmptyObject, isEmptyValue } from './helpers';
import { defaultComparatorFields } from "./internal-types";

export type ObjectsComparatorFn<T = any> = (obj1: T, obj2: T) => boolean;

export type ObjectsComparator = {
  equal: ObjectsComparatorFn;
}

export class Comparator implements ObjectsComparator {
  public readonly renderDefaultComparatorError: boolean;
  private readonly fields: (string | string[])[];

  constructor(fields = defaultComparatorFields) {
    if (!fields) {
      this.renderDefaultComparatorError = true;
      this.fields = defaultComparatorFields;
    } else {
      this.fields = fields;
      this.renderDefaultComparatorError = false;
    }
  }

  equal(obj1: unknown, obj2: unknown, byFields?: (string | string[])[]): boolean {
    if (Object.is(obj1, obj2)) {
      return true;
    }
    if (obj1 == null || obj1 !== obj1 || obj2 == null || obj2 !== obj2 || (typeof obj1 !== 'object') || (typeof obj2 !== 'object')) {
      return false;
    }
    const fields = byFields?.length ? byFields : this.fields;
    if (fields.length) {
      for (const field of fields) {
        if (typeof field === 'string') {
          const value1 = getObjectPathValue(obj1, field);
          const value2 = getObjectPathValue(obj2, field);
          if (value1 !== undefined && value2 !== undefined) {
            if (fieldValuesAreNotEmptyAndEqual(obj1, obj2, field)) {
              return true;
            } else {
              // stop the chain on the first found pair of existing fields
              return false;
            }
          }
        } else {
          if (!field.find(key => !fieldValuesAreNotEmptyAndEqual(obj1, obj2, key))) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

function fieldValuesAreNotEmptyAndEqual(obj1: unknown, obj2: unknown, field: string): boolean {
  const value1 = getObjectPathValue(obj1 as any, field);
  if (value1 === undefined) {
    return false;
  }
  const value2 = getObjectPathValue(obj2 as any, field);
  if (value2 === undefined) {
    return false;
  }

  return (!isEmptyValue(value1)
    && !isEmptyValue(value2)
    && !isEmptyObject(value1)
    && !isEmptyObject(value2)
    && value1 === value2
  );
}

export class DuplicateError extends Error {
  constructor(...params: Parameters<typeof Error>) {
    super(...params);
    this.name = 'DuplicateError';

    // Reasons of ts-ignore usage you can find here:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#sect3
    //
    // @ts-ignore
    if (Error.captureStackTrace) {
      // @ts-ignore
      Error.captureStackTrace(this, DuplicateError);
    }
  }
}
