export function isEmptyValue(variable: unknown): boolean {
  if ((typeof variable === 'undefined') || variable === null || (variable !== variable)) {
    return true;
  }
  if (variable === 0 || variable === '0' || variable === 'false' || typeof variable === 'boolean') {
    return false;
  }
  if (typeof variable === 'object') {
    if (Array.isArray(variable)) {
      return variable.length === 0 || (variable.length === 1 && isEmptyObject(variable[0]));
    }
    return false;
  }
  return !variable;
}

export function isEmptyObject(variable: unknown): boolean {
  if (variable == null || isEmptyValue(variable)) {
    return true;
  }
  if (typeof variable === 'object') {
    try {
      const props = Object.keys(variable);
      if (!props || !props.length) {
        return true;
      }
    } catch (e) {
      console?.error(e);
    }
  }
  return false;
}

export function getObjectPathValue<T = any>(object: Record<string, any>, path: string, recLevel?: number): T | undefined {
  if (object == null) {
    return undefined;
  }
  if (!path.includes('.')) {
    return object[path];
  }
  try {
    const paths = path.split('.');
    const key = paths.shift();
    if (!key) {
      return undefined;
    }
    if (paths.length > 0) {
      const rec = recLevel || 0;
      if (rec > 100) {
        console.error('getObjectPathValue endless recursion');
        return undefined;
      }
      return getObjectPathValue(object[key], paths.join('.'), rec + 1);
    } else {
      return object[key];
    }
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

/**
 * Non-primitive values are considered non-equal.
 * Primitive values are compared using Object.is().
 *
 * Objects (including arrays) will always be non-equal,
 * it might be useful for updating mutable structures.
 * It is recommended to use immutable structures,
 * but there are rare cases when mutable structures suit better,
 * or objects can not be cloned.
 **/
export function equalPrimitives<T>(a: T, b: T): boolean {
  return (a === null || typeof a !== 'object') && Object.is(a, b);
}
