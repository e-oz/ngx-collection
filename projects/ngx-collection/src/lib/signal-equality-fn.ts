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
  return a.every((v, i) => v === b[i]);
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
