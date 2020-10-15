import Vue from 'vue';
import { isObject, isArray } from './utils';

let __$reactiveIns = [];
let __$targetVM = null;
let __$Vue = null;

export class Reactive {
  $target = null;
  _memorized = false;
  _watch = {};
  _computed = {};
  _provide = {};

  constructor(record = true) {
    this.$initMethods(record);
    this._memorized = __$targetVM === null;
    // console.log('this._memorized: ', this._memorized);
    if (this._memorized && record) {
      this.$memorizeState();
    }
  }

  $initMethods(record: boolean = true) {
    if (record) {
      this.$target = __$targetVM;
      __$reactiveIns.push(this);
    }

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
    Object.keys(reactiveIns).forEach(function (key) {
      if (
        (reactiveIns[key] instanceof Function) ||
        key === '$target' ||
        key.startsWith('_')
      ) return;

      $state[key] = reactiveIns[key];
      Object.defineProperty(reactiveIns, key, {
        get() {
          if ($vm[key] === undefined) return $state[key];
          return $vm[key];
        },
        set(val) {
          let newVal;
          if (isObject(val)) {
            newVal = __$Vue.observable(val);
          } else if (isArray(val)) {
            newVal = __$Vue.observable(val);
          } else {
            newVal = val;
          }
          $state[key] = newVal;
          $vm[key] = newVal;
        }
      });
    });
  }

  $memorizeState() {
    const reactiveIns = this;
    __$Vue = Vue;
    const memorizedState = __$Vue.observable({});
    Object.keys(reactiveIns).forEach((key) => {
      if (
        (reactiveIns[key] instanceof Function) ||
        key === '$target' ||
        key.startsWith('_')
      ) return;

      this.$set(memorizedState, key, reactiveIns[key]);
      Object.defineProperty(reactiveIns, key, {
        get() {
          return memorizedState[key];
        },
        set(val) {
          __$Vue.set(memorizedState, key, val);
        }
      });
    });
  }

  $set(target, key, value) {
    return __$Vue.set(target, key, value);
  }

  $delete(target, key) {
    return __$Vue.delete(target, key);
  }

  $watch(key: string, watchHandler: Function | { handler: Function, deep?: boolean, immediate?: boolean }) {
    const self = this;
    if (watchHandler instanceof Function) {
      this._watch[key] = function () {
        watchHandler.apply(self, arguments);
      }
    } else if (isObject(watchHandler)) {
      const { handler } = watchHandler;
      if (handler instanceof Function) {
        watchHandler.handler = function () {
          handler.apply(self, arguments);
        }
      }
      this._watch[key] = watchHandler;
    }
  }

  $computed(key: string, computedHandler: Function) {
    const self = this;
    if (computedHandler instanceof Function) {
      this._computed[key] = function () {
        return computedHandler.apply(self, arguments);
      }
      Object.defineProperty(self, key, {
        get() {
          return self.$target[key]
        }
      })
    }
  }

  $registerProvide(name) {
    this._provide[name] = this;
  }

  static from(childFn) {
    function Reactive$$() {
      const reactive = new Reactive(false);
      Object.keys(reactive).forEach(key => {
        if (reactive[key] instanceof Function) return;
        this[key] = reactive[key];
      });
      childFn.apply(this, arguments);

      this._memorized = __$targetVM === null;
      reactive.$initMethods.call(this, !reactive._memorized);
      if (this._memorized) {
        this.$memorizeState();
      }
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

          // 如果data选项是函数先执行拿到数据结构
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

            // 获取组件属性传入setup函数
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
                // 新增组件方法
                if ($vm[key] === undefined) $vm[key] = props[key];
              } else {
                // 新增data数据
                $options.data[key] = props[key];
              }
            });
          });
          __$reactiveIns.forEach(function (reactiveIns) {
            reactiveIns.$initData();
            // 合并computed选项
            $options.computed = $options.computed || {};
            if (isObject(reactiveIns._computed)) $options.computed = Object.assign($options.computed, reactiveIns._computed);
            // 合并watch选项
            $options.watch = $options.watch || {};
            if (isObject(reactiveIns._watch)) $options.watch = Object.assign($options.watch, reactiveIns._watch);
            // 合并provide选项
            $options.provide = $options.provide || {};
            if (isObject(reactiveIns._provide)) $options.provide = Object.assign($options.provide, reactiveIns._provide);
          });
          __$reactiveIns = [];
          __$targetVM = null;
        }
      }
    });
  }
}

// @ts-ignore
if (window.Vue) {
  // @ts-ignore
  window.Vue.use(reactiveInstall);
  // @ts-ignore
  window.Reactive = Reactive;
}

