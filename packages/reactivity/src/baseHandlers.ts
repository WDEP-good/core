import {
  type Target,
  isReadonly,
  isShallow,
  reactive,
  reactiveMap,
  readonly,
  readonlyMap,
  shallowReactiveMap,
  shallowReadonlyMap,
  toRaw,
} from './reactive'
import { arrayInstrumentations } from './arrayInstrumentations'
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from './constants'
import { ITERATE_KEY, track, trigger } from './dep'
import {
  hasChanged,
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
  isSymbol,
  makeMap,
} from '@vue/shared'
import { isRef } from './ref'
import { warn } from './warning'

const isNonTrackableKeys = /*@__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
  /*@__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => Symbol[key as keyof SymbolConstructor])
    .filter(isSymbol),
)

function hasOwnProperty(this: object, key: unknown) {
  // #10455 hasOwnProperty may be called with non-string values
  if (!isSymbol(key)) key = String(key)
  const obj = toRaw(this)
  track(obj, TrackOpTypes.HAS, key)
  return obj.hasOwnProperty(key as string)
}

/**
 * 基础响应式处理程序
 */
class BaseReactiveHandler implements ProxyHandler<Target> {
  // 初始化属性
  constructor(
    protected readonly _isReadonly = false, // 是否只读
    protected readonly _isShallow = false, // 是否浅层
  ) {}

  // get方法——获取属性

  /**
   * 获取属性
   * @param target 目标对象
   * @param key 键
   * @param receiver 接收者
   * @returns 属性值
   *
   * @example
   * target = {
   *   name: 'John',
   *   age: 20,
   * }
   * key = 'name'
   * receiver = {
   *   name: 'John',
   *   age: 20,
   * }
   *
   * @example
   * target = [1, 2, 3]
   * key = 'push'
   * receiver = {
   *   push: function(value) {
   *     console.log('push', value)
   *   }
   */
  get(target: Target, key: string | symbol, receiver: object): any {
    // 如果key是SKIP，则返回target[SKIP]
    if (key === ReactiveFlags.SKIP) return target[ReactiveFlags.SKIP]

    // 获取相关属性
    const isReadonly = this._isReadonly,
      isShallow = this._isShallow
    // 如果key是IS_REACTIVE，则说明不是只读响应式,返回!isReadonly
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
      // 如果key是IS_READONLY，则说明是只读响应式,返回isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
      // 如果key是IS_SHALLOW，则说明是浅层响应式,返回isShallow
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return isShallow
      // 如果key是RAW，则说明是原始响应式,返回target
    } else if (key === ReactiveFlags.RAW) {
      if (
        receiver ===
          (isReadonly
            ? isShallow
              ? shallowReadonlyMap
              : readonlyMap
            : isShallow
              ? shallowReactiveMap
              : reactiveMap
          ).get(target) ||
        // receiver不是响应式代理，但有相同的原型
        // 这意味着receiver是响应式代理的user proxy
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
      ) {
        return target
      }
      return
    }
    // 判断target是否是数组
    const targetIsArray = isArray(target)
    // 如果target不是只读，则判断key是否是数组方法
    if (!isReadonly) {
      let fn: Function | undefined
      // 如果target是数组，并且key是数组方法，则返回数组方法
      if (targetIsArray && (fn = arrayInstrumentations[key])) {
        return fn
      }
      // 如果key是hasOwnProperty，则返回hasOwnProperty——用于判断对象是否重写了hasOwnProperty方法
      if (key === 'hasOwnProperty') {
        return hasOwnProperty
      }
    }
    // 获取属性值 使用反射获取属性值(确保不会触发依赖追踪)
    // 使用反射做数据劫持
    const res = Reflect.get(
      target,
      key,
      // 如果target是ref，则返回target的value
      isRef(target) ? target : receiver,
    )

    // 如果key是Symbol，则返回res
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    // 如果target不是只读，则触发依赖追踪
    if (!isReadonly) {
      // 触发依赖追踪
      track(target, TrackOpTypes.GET, key)
    }

    // 如果target是浅层响应式，则直接返回res
    if (isShallow) {
      return res
    }

    // 如果res是ref，则返回res的value
    if (isRef(res)) {
      // 如果target是数组，并且key是整数，则返回res，否则返回res的value
      return targetIsArray && isIntegerKey(key) ? res : res.value
    }

    // 如果res是对象，则返回响应式对象
    if (isObject(res)) {
      // 如果target是只读，则返回readonly(res)，否则返回reactive(res)
      return isReadonly ? readonly(res) : reactive(res)
    }
    // 以上都不满足，则直接返回res
    return res
  }
}

/**
 * 可变响应式处理程序
 */
class MutableReactiveHandler extends BaseReactiveHandler {
  // 初始化是否是浅层响应式，默认是false
  constructor(isShallow = false) {
    // 调用父类构造函数，设置是否是只读，是否是浅层响应式
    super(false, isShallow)
  }

  set(
    target: Record<string | symbol, unknown>,
    key: string | symbol,
    value: unknown,
    receiver: object,
  ): boolean {
    // 获取旧值
    let oldValue = target[key]
    // 如果target不是浅层响应式，则判断oldValue是否是只读
    if (!this._isShallow) {
      // 判断oldValue是否是只读
      const isOldValueReadonly = isReadonly(oldValue)
      // 如果value不是浅层响应式，并且value不是只读，则将oldValue和value转换为原始值
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue)
        value = toRaw(value)
      }
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        if (isOldValueReadonly) {
          return false
        } else {
          oldValue.value = value
          return true
        }
      }
    } else {
      // 如果target是浅层响应式，则直接设置value
    }
    // 判断target是否是数组，并且key是否是整数
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)
    const result = Reflect.set(
      target,
      key,
      value,
      isRef(target) ? target : receiver,
    )
    // don't trigger if target is something up in the prototype chain of original
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }

  deleteProperty(
    target: Record<string | symbol, unknown>,
    key: string | symbol,
  ): boolean {
    // 判断target是否包含key
    const hadKey = hasOwn(target, key)
    // 获取旧值
    const oldValue = target[key]
    // 删除属性
    const result = Reflect.deleteProperty(target, key)
    // 如果删除成功且存在旧值，则触发依赖追踪
    if (result && hadKey) {
      // 触发依赖追踪
      trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
    }
    // 返回删除结果——是否删除成功
    return result
  }

  // has方法——判断对象是否包含指定属性
  has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
    // 判断target是否包含key
    const result = Reflect.has(target, key)
    // 如果key是Symbol，则触发依赖追踪
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      // 触发依赖追踪
      track(target, TrackOpTypes.HAS, key)
    }
    return result
  }

  ownKeys(target: Record<string | symbol, unknown>): (string | symbol)[] {
    track(
      target,
      TrackOpTypes.ITERATE,
      isArray(target) ? 'length' : ITERATE_KEY,
    )
    return Reflect.ownKeys(target)
  }
}

/**
 * 只读响应式处理程序
 */
class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow = false) {
    super(true, isShallow)
  }

  set(target: object, key: string | symbol) {
    if (__DEV__) {
      warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target,
      )
    }
    return true
  }

  deleteProperty(target: object, key: string | symbol) {
    if (__DEV__) {
      warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target,
      )
    }
    return true
  }
}

export const mutableHandlers: ProxyHandler<object> =
  /*@__PURE__*/ new MutableReactiveHandler()

export const readonlyHandlers: ProxyHandler<object> =
  /*@__PURE__*/ new ReadonlyReactiveHandler()

export const shallowReactiveHandlers: MutableReactiveHandler =
  /*@__PURE__*/ new MutableReactiveHandler(true)

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers: ReadonlyReactiveHandler =
  /*@__PURE__*/ new ReadonlyReactiveHandler(true)
