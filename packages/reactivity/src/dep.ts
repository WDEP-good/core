import { extend, isArray, isIntegerKey, isMap, isSymbol } from '@vue/shared'
import type { ComputedRefImpl } from './computed'
import { type TrackOpTypes, TriggerOpTypes } from './constants'
import {
  type DebuggerEventExtraInfo,
  EffectFlags,
  type Subscriber,
  activeSub,
  endBatch,
  shouldTrack,
  startBatch,
} from './effect'

/**
 * 每当响应式数据发生变化时递增
 * 这用于为计算属性（computed）提供一种快速路径，以便在没有变化时避免重新计算。
 */
export let globalVersion = 0

/**
 * 表示依赖（Dep）和订阅者（Effect 或 Computed）之间的链接。
 * Deps 和 subs 具有多对多关系 - dep 和 sub 之间的每个链接都由一个 Link 实例表示。
 *
 * Link 也是两个双向链表中的一个节点 - 一个用于关联的 sub 来跟踪其所有 deps，
 * 另一个用于关联的 dep 来跟踪其所有 subs。
 *
 */
export class Link {
  /**
   * 在每次副作用运行之前，所有先前的 dep 链接的版本都会被重置为 -1
   * 在运行期间，链接的版本会与源 dep 的版本同步
   * 在运行之后，版本为 -1 的链接（从未使用过）会被清理
   */
  version: number

  /**
   * 双向链表的指针
   */
  nextDep?: Link // 下一个依赖
  prevDep?: Link // 上一个依赖
  nextSub?: Link // 下一个订阅者
  prevSub?: Link // 上一个订阅者
  prevActiveLink?: Link // 上一个活跃的链接(用于记录深层副作用嵌套，相当于中断机制)
  // 构造函数(构建实例时候默认初始化)
  constructor(
    public sub: Subscriber, // 订阅者,这种写法相当于 this.sub = sub
    public dep: Dep, // 依赖
  ) {
    this.version = dep.version // 初始化版本
    // 初始化指针（双向链表）全部指向undefined
    this.nextDep =
      this.prevDep =
      this.nextSub =
      this.prevSub =
      this.prevActiveLink =
        undefined
  }
}

/**
 * 依赖类，用于记录依赖的版本和订阅者
 *
 */
export class Dep {
  version = 0 // 版本
  /**
   * 当前活跃的链接
   */
  activeLink?: Link = undefined

  /**
   * 订阅者
   */
  subs?: Link = undefined

  /**
   * 订阅者双向链表的头部
   * 仅用于开发环境，用于正确调用 onTrigger 钩子
   */
  subsHead?: Link

  /**
   * 对象属性依赖的清理
   */
  map?: KeyToDepMap = undefined // 映射
  key?: unknown = undefined // 键

  /**
   * 订阅者计数器
   */
  sc: number = 0 // 订阅者计数器

  /**
   * 跳过响应式处理
   */
  readonly __v_skip = true // 跳过响应式处理
  // TODO isolatedDeclarations ReactiveFlags.SKIP

  constructor(public computed?: ComputedRefImpl | undefined) {
    if (__DEV__) {
      this.subsHead = undefined
    }
  }

  track(debugInfo?: DebuggerEventExtraInfo): Link | undefined {
    if (!activeSub || !shouldTrack || activeSub === this.computed) {
      return
    }

    let link = this.activeLink
    if (link === undefined || link.sub !== activeSub) {
      link = this.activeLink = new Link(activeSub, this)

      // add the link to the activeEffect as a dep (as tail)
      if (!activeSub.deps) {
        activeSub.deps = activeSub.depsTail = link
      } else {
        link.prevDep = activeSub.depsTail
        activeSub.depsTail!.nextDep = link
        activeSub.depsTail = link
      }

      addSub(link)
    } else if (link.version === -1) {
      // reused from last run - already a sub, just sync version
      link.version = this.version

      // If this dep has a next, it means it's not at the tail - move it to the
      // tail. This ensures the effect's dep list is in the order they are
      // accessed during evaluation.
      if (link.nextDep) {
        const next = link.nextDep
        next.prevDep = link.prevDep
        if (link.prevDep) {
          link.prevDep.nextDep = next
        }

        link.prevDep = activeSub.depsTail
        link.nextDep = undefined
        activeSub.depsTail!.nextDep = link
        activeSub.depsTail = link

        // this was the head - point to the new head
        if (activeSub.deps === link) {
          activeSub.deps = next
        }
      }
    }

    if (__DEV__ && activeSub.onTrack) {
      activeSub.onTrack(
        extend(
          {
            effect: activeSub,
          },
          debugInfo,
        ),
      )
    }

    return link
  }

  // 触发依赖(派发更新)——用于触发依赖更新。当响应式数据发生变化时，会调用此方法来通知所有相关的副作用函数重新执行。
  trigger(debugInfo?: DebuggerEventExtraInfo): void {
    // 每次触发依赖时，递增依赖的版本
    this.version++
    // 递增全局版本
    globalVersion++
    // 通知依赖更新，传递debugInfo参数
    this.notify(debugInfo)
  }

  notify(debugInfo?: DebuggerEventExtraInfo): void {
    // 开始批量更新
    startBatch()
    try {
      if (__DEV__) {
        // 通知订阅者，批量处理，逆序处理，最后在批量结束时按原始顺序调用
        // 但onTrigger钩子应该按原始顺序调用
        for (let head = this.subsHead; head; head = head.nextSub) {
          if (head.sub.onTrigger && !(head.sub.flags & EffectFlags.NOTIFIED)) {
            head.sub.onTrigger(
              extend(
                {
                  effect: head.sub,
                },
                debugInfo,
              ),
            )
          }
        }
      }
      // 遍历订阅者
      for (let link = this.subs; link; link = link.prevSub) {
        // 如果订阅者返回true，则说明是计算属性
        if (link.sub.notify()) {
          // 如果notify()返回true，则说明是计算属性。
          // 也调用它的依赖的notify() - 它在这里而不是在计算属性的notify()中调用，
          // 以减少调用堆栈深度。
          ;(link.sub as ComputedRefImpl).dep.notify()
        }
      }
    } finally {
      // 结束批量更新
      endBatch()
    }
  }
}

// 添加订阅者——用于将订阅者添加到依赖中。当副作用函数被添加为依赖的订阅者时，会调用此方法。
function addSub(link: Link) {
  // 递增订阅者计数器
  link.dep.sc++
  // 如果订阅者的标志中有TRACKING标志，则说明是计算属性
  if (link.sub.flags & EffectFlags.TRACKING) {
    // 获取依赖的计算属性
    const computed = link.dep.computed
    // 计算属性获得它的第一个订阅者，启用依赖追踪，并延迟订阅它的所有依赖
    if (computed && !link.dep.subs) {
      // 启用依赖追踪，并延迟订阅它的所有依赖
      computed.flags |= EffectFlags.TRACKING | EffectFlags.DIRTY
      // 遍历计算属性的所有依赖
      for (let l = computed.deps; l; l = l.nextDep) {
        addSub(l)
      }
    }

    // 获取依赖的订阅者
    const currentTail = link.dep.subs
    // 如果当前的尾部不等于link，则说明是计算属性，需要将link添加到尾部
    if (currentTail !== link) {
      // 将link添加到尾部
      link.prevSub = currentTail
      // 将link添加到尾部
      if (currentTail) currentTail.nextSub = link
    }

    // 如果开发环境，并且订阅者的头部为undefined，则说明是计算属性，需要将link添加到头部
    if (__DEV__ && link.dep.subsHead === undefined) {
      // 将link添加到头部
      link.dep.subsHead = link
    }

    // 将link添加到尾部
    link.dep.subs = link
  }
}

// 定义 KeyToDepMap 类型：Map<any, Dep>
// 这个类型表示从属性键到依赖对象的映射关系
// - 键（key）：响应式对象的属性名
// - 值（value）：对应的 Dep 依赖对象，用于管理该属性的订阅者
type KeyToDepMap = Map<any, Dep>

// 核心数据结构：targetMap
// 这是一个 WeakMap，用于存储整个响应式系统的依赖关系
// 结构：{ 目标对象 -> 属性键 -> 依赖 }
export const targetMap: WeakMap<object, KeyToDepMap> = new WeakMap()

// 可迭代对象的key
export const ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Object iterate' : '',
)

// Map对象的key的可迭代对象的key
export const MAP_KEY_ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Map keys iterate' : '',
)

// 数组的key的可迭代对象的key
export const ARRAY_ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Array iterate' : '',
)

/**
 * 跟踪对响应式属性的访问。
 *
 * 该方法会检查当前正在运行的副作用（effect），并将其记录为依赖（dep），
 * 这样 dep 就能记录所有依赖该响应式属性的副作用。
 */
export function track(target: object, type: TrackOpTypes, key: unknown): void {
  if (shouldTrack && activeSub) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Dep()))
      dep.map = depsMap
      dep.key = key
    }
    if (__DEV__) {
      dep.track({
        target,
        type,
        key,
      })
    } else {
      dep.track()
    }
  }
}

/**
 * 派发更新依赖，查找与目标（或特定属性）相关的所有依赖，并触发存储在这些依赖中的副作用。
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>,
): void {
  // 获取目标对象的依赖映射
  const depsMap = targetMap.get(target)
  // 如果不存在这个依赖映射，则说明这个对象从未被跟踪过，则递增全局版本
  if (!depsMap) {
    // 从未被跟踪过，递增全局版本
    globalVersion++
    return
  }

  // 执行依赖函数(派发更新)
  const run = (dep: Dep | undefined) => {
    // 如果存在依赖，则触发依赖
    if (dep) {
      // 开发环境，传入参数，触发依赖函数
      if (__DEV__) {
        dep.trigger({
          target,
          type,
          key,
          newValue,
          oldValue,
          oldTarget,
        })
      } else {
        // 生产环境，触发依赖函数
        dep.trigger()
      }
    }
  }

  // 开始批量更新
  startBatch()

  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    depsMap.forEach(run)
  } else {
    const targetIsArray = isArray(target)
    const isArrayIndex = targetIsArray && isIntegerKey(key)

    if (targetIsArray && key === 'length') {
      const newLength = Number(newValue)
      depsMap.forEach((dep, key) => {
        if (
          key === 'length' ||
          key === ARRAY_ITERATE_KEY ||
          (!isSymbol(key) && key >= newLength)
        ) {
          run(dep)
        }
      })
    } else {
      // schedule runs for SET | ADD | DELETE
      if (key !== void 0 || depsMap.has(void 0)) {
        run(depsMap.get(key))
      }

      // schedule ARRAY_ITERATE for any numeric key change (length is handled above)
      if (isArrayIndex) {
        run(depsMap.get(ARRAY_ITERATE_KEY))
      }

      // also run for iteration key on ADD | DELETE | Map.SET
      switch (type) {
        case TriggerOpTypes.ADD:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY))
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          } else if (isArrayIndex) {
            // new index added to array -> length changes
            run(depsMap.get('length'))
          }
          break
        case TriggerOpTypes.DELETE:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY))
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          }
          break
        case TriggerOpTypes.SET:
          if (isMap(target)) {
            run(depsMap.get(ITERATE_KEY))
          }
          break
      }
    }
  }

  // 结束批量更新
  endBatch()
}

// 从响应式对象中获取依赖
export function getDepFromReactive(
  object: any,
  key: string | number | symbol,
): Dep | undefined {
  // 获取这个对象的依赖映射
  const depMap = targetMap.get(object)
  // 如果存在依赖映射，则获取对应的依赖
  return depMap && depMap.get(key)
}
