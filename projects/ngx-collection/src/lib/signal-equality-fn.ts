export function equalArrays<T>(a: T[], b: T[]): boolean {
  if (a === b) {
    return true;
  }
  try {
    if ((a == null || b == null) || (!Array.isArray(a) || !Array.isArray(b))) {
      return false;
    }
    if (a.length === 0 && b.length === 0) {
      return true;
    }
    return equalArrValues(a, b);
  } catch (_) {
    return false;
  }
}

function equalArrValues<A>(a: A[], b: A[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  if (a.length === 0 && b.length === 0) {
    return true;
  }
  return a.every((v, i) => {
    const x = v;
    const y = b[i];
    return x === y
      || (x == null && y == null)
      || (Array.isArray(x) && Array.isArray(y) && x.length === 0 && y.length === 0)
      || ((x instanceof Map) && (y instanceof Map) && x.size === 0 && y.size === 0)
      || ((x instanceof Set) && (y instanceof Set) && x.size === 0 && y.size === 0)
  });
}

export function equalMaps<M, N>(a: Map<M, N>, b: Map<M, N>): boolean {
  if (a === b) {
    return true;
  }
  try {
    if ((a == null || b == null) || (!(a instanceof Map) || !(b instanceof Map))) {
      return false;
    }
    if (a.size !== b.size) {
      return false;
    }
    if (a.size === 0 && b.size === 0) {
      return true;
    }
    const keysA = Array.from(a.keys());
    const keysB = Array.from(b.keys());
    if (!equalArrValues(keysA, keysB)) {
      return false;
    }
    const valuesA = keysA.map(k => a.get(k)!);
    const valuesB = keysB.map(k => b.get(k)!);
    return equalArrValues(valuesA, valuesB);
  } catch (_) {
    return false;
  }
}

export function equalSets<S>(a: Set<S>, b: Set<S>): boolean {
  if (a === b) {
    return true;
  }
  try {
    if ((a == null || b == null) || (!(a instanceof Set) || !(b instanceof Set))) {
      return false;
    }
    if (a.size !== b.size) {
      return false;
    }
    if (a.size === 0 && b.size === 0) {
      return true;
    }
    return equalArrValues(Array.from(a), Array.from(b));
  } catch (_) {
    return false;
  }
}

export function equalObjects<T>(a: T, b: T): boolean {
  if (a === b) {
    return true;
  }
  try {
    // 2 checks should be placed one after another.
    // 1: only if both of them are nulls
    if (a == null && b == null) {
      return true;
    }
    // 2: and here we know that at least one of them is not null
    // (otherwise the previous check would be triggered)
    if (a == null || b == null) {
      return false;
    }
    //
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) {
        return false;
      }
      if (equalArrays(a, b)) {
        return true;
      }
    } else {
      if (Array.isArray(b)) {
        return false;
      }
    }

    if ((a instanceof Map)) {
      if (!(b instanceof Map)) {
        return false;
      }
      if (equalMaps(a, b)) {
        return true;
      }
    } else {
      if (b instanceof Map) {
        return false;
      }
    }

    if ((a instanceof Set)) {
      if (!(b instanceof Set)) {
        return false;
      }
      if (equalSets(a, b)) {
        return true;
      }
    } else {
      if (b instanceof Set) {
        return false;
      }
    }

    if (typeof a !== 'object' || typeof b !== 'object') {
      return false;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (!equalArrValues(keysA, keysB)) {
      return false;
    }
    const valuesA = keysA.map(k => (a as any)[k]!);
    const valuesB = keysB.map(k => (b as any)[k]!);
    return equalArrValues(valuesA, valuesB);
  } catch (_) {
    return false;
  }
}

/**
 * Contains functions for checking the equality of values, optimized for arrays, maps, sets, and objects.
 *
 * The goals of these functions are:
 * 1. To reduce the number of unnecessary computations;
 * 2. To compare values as quickly as possible.
 *
 * First of all, if values are equal by reference (`===`), they are considered equal.
 * After that, for arrays, sets, maps, and objects, the first level of contained items (keys) will be compared using `===`.
 * If values are empty sets, arrays, or maps, they are equal. Empty objects are not equal.
 * If both values are `null` or `undefined`, they are equal.
 * The check is non-recursive and shallow.
 * For a recursive, deep equality check, use specialized and optimized functions that you trust.
 **/
export const signalEqual = {
  arrays: equalArrays,
  sets: equalSets,
  maps: equalMaps,
  objects: equalObjects,
};