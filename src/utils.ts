export function noop() {}

export function isObject(obj: any) {
  return Object.prototype.toString.call(obj) === "[object Object]";
}

export function isArray(arr: any) {
  return Array.isArray(arr);
}