export function isEmptyValue(variable: unknown): boolean {
  if ((typeof variable === 'undefined') || variable === null || (variable !== variable)) {
    return true;
  }
  if (variable === 0 || variable === '0' || variable === 'false' || typeof variable === 'boolean') {
    return false;
  }
  if (typeof variable === 'object') {
    if (variable instanceof Array) {
      return variable.length === 0 || (variable.length === 1 && isEmptyObject(variable[0]));
    }
    return false;
  }
  return !variable;
}

export function isEmptyObject(variable: unknown): boolean {
  if (isEmptyValue(variable)) {
    return true;
  }
  if (typeof variable === 'object') {
    try {
      const props = Object.getOwnPropertyNames(variable);
      if (!props || !props.length) {
        return true;
      }
    } catch (e) {
      console?.error(e);
    }
  }
  return false;
}
