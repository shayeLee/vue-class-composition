import { noop, isArray } from './utils';

export default class Watcher {
  deps = {};

  addDep(property: string, cb: Function) {
    if (typeof property === 'string') {
      this.deps[property] = this.deps[property] || [];
      this.deps[property].push(cb);
      return (property) => this.removeDep(property);
    }
    return noop
  }

  removeDep(property: string) {
    delete this.deps[property];
  }

  evaluate(reactiveIns, property: string, newVal, oldVal) {
    const fnArray = isArray(this.deps[property]) ? this.deps[property] : null;
    if (fnArray === null) return;
    
    fnArray.forEach(fn => {
      fn.call(reactiveIns, newVal, oldVal);
    });
  }
}