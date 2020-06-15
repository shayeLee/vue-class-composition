import { isObject, isArray } from './utils';
import Watcher from './watcher'

let __$reactiveIns = [];
let __$targetVM = null;
let __$Vue = null;

export class Reactive {
  $target = null;
  $deps: {};
  $watcher: Watcher = null;
  _targetComputed = '';
  $computedKeys = [];
  $computeHandles = {};
  $computeDeps = {};

  constructor(deps?: object) {
    this.$initMethods();
    this.$watcher = new Watcher();
    this.$deps = deps;
  }

  $initMethods() {
    // @ts-ignore
    this.$target = __$targetVM;
    __$reactiveIns.push(this);
    // @ts-ignore
    const protoKeys = Object.getOwnPropertyNames(this.constructor.prototype).concat(Object.keys(this));
    protoKeys.forEach(key => {
      if (
        key === 'constructor' ||
        key === '$initMethods' ||
        key === '$initData' ||
        key === '$set' ||
        key === '$delete' ||
        key === '$watch' ||
        key === '$initComputed' ||
        key === '$computed'
      ) return;
      const isProtoMethod = this.constructor.prototype[key] instanceof Function;
      const isMethod = this[key] instanceof Function;
      if (isProtoMethod || isMethod) {
        let method;
        if (isMethod) {
          method = this[key];
        } else if (isProtoMethod && !isMethod) {
          method = this.constructor.prototype[key];
        }
        const self = this;
        this[key] = function () {
          return method.apply(self, arguments);
        };
      }
    })
  }

  $initData() {
    const reactiveIns = this;
    const $vm = this.$target;
    const $state = {};
    Object.keys(reactiveIns).concat(this.$computedKeys).forEach(function (key) {
      if (
        (reactiveIns[key] instanceof Function) ||
        key === '$target' ||
        key === '$watcher' ||
        key === '$computeHandles' ||
        key === '_targetComputed' ||
        key === '$computeDeps' ||
        key === '$computedKeys' ||
        key === '$deps' ||
        key.startsWith('_')
      ) return;

      $state[key] = reactiveIns[key];
      Object.defineProperty(reactiveIns, key, {
        get() {
          if (this._targetComputed) {
            this.$computeDeps[this._targetComputed] = this.$computeDeps[this._targetComputed] || [];
            this.$computeDeps[this._targetComputed].push(key);
          }
          if ($vm[key] === undefined) return $state[key];
          return $vm[key];
        },
        set(val) {
          let newVal, oldVal;
          if (isObject(val)) {
            newVal = __$Vue.observable(val);
            oldVal = { ...$state[key] };
          } else if (isArray(val)) {
            newVal = __$Vue.observable(val);
            oldVal = [...$state[key]];
          } else {
            newVal = val;
            oldVal = $state[key];
          }
          // Promise.resolve().then(() => reactiveIns.$watcher.evaluate(reactiveIns, key, newVal, oldVal));
          $state[key] = newVal;
          $vm[key] = newVal;
        }
      });
    });
  }

  $initComputed() {
    Object.keys(this.$computeHandles).forEach(key => {
      if (this.$computeHandles[key] instanceof Function) this.$computeHandles[key].call(this);
    });
  }

  $set(target, key, value) {
    return __$Vue.set(target, key, value);
  }

  $delete(target, key) {
    return __$Vue.delete(target, key);
  }

  $watch(property: string, cb: Function) {
    this.$watcher.addDep(property, cb);
  }

  $computed(property: string, _cb: Function) {
    const _computed = { value: undefined };
    this.$computedKeys.push(property);
    const self = this;
    Object.defineProperty(_computed, 'value', {
      set(val) {
        self[property] = val;
        self.$target.$options.data[property] = val;
      }
    });
    this.$computeHandles[property] = function () {
      const cb = _cb;
      this._targetComputed = property;
      _computed.value = cb.call(this);
      this._targetComputed = '';
      if (isArray(this.$computeDeps[property])) {
        const deps = this.$computeDeps[property];
        deps.forEach(name => {
          this.$watch(name, function () {
            this[property] = cb.call(this);
          });
        })
      }
    }
  }

  static from(childFn) {
    function Reactive$$() {
      const reactive = new Reactive();
      Object.keys(reactive).forEach(key => {
        if (reactive[key] instanceof Function) return;
        this[key] = reactive[key];
      });
      childFn.apply(this, arguments);
      reactive.$initMethods.call(this);
    }

    const protoKeys = Object.getOwnPropertyNames(Reactive.prototype);
    protoKeys.forEach(key => {
      if (key === 'constructor') return;
      if (Reactive.prototype[key] instanceof Function) Reactive$$.prototype[key] = Reactive.prototype[key];
    })

    return Reactive$$;
  }
}

export const reactiveInstall = {
  install(Vue) {
    __$Vue = Vue;
    const strategies = Vue.config.optionMergeStrategies;
    strategies.setup = strategies.created;

    Vue.mixin({
      beforeCreate() {
        const $vm = this;
        const $options = $vm.$options;
        // @ts-ignore
        if (isArray($options.setup) && $options.setup.length > 0) {
          let data = {};
          if (isObject($options.data)) {
            data = $options.data;
          } else if ($options.data instanceof Function) {
            // @ts-ignore
            data = $options.data();
          }
          $options.data = data;

          __$targetVM = $vm;
          // @ts-ignore
          $options.setup.forEach(fn => {
            const propsData = {};
            if (isObject($options.props)) {
              Object.keys($options.props).forEach(key => {
                propsData[key] = undefined;
                Object.defineProperty(propsData, key, {
                  get() {
                    return $vm[key];
                  }
                });
              })
            }
            const props = fn(propsData, $vm);
            Object.keys(props).forEach(key => {
              if (props[key] instanceof Function) {
                $vm[key] = props[key];
              } else {
                $options.data[key] = props[key];
              }
            });
          });
          __$reactiveIns.forEach(function (reactiveIns) {
            reactiveIns.$initData();
            reactiveIns.$initComputed();
          });
          __$reactiveIns = [];
          __$targetVM = null;
        }
      }
    });
  }
}