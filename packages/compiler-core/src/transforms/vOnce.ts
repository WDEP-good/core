import type { NodeTransform } from '../transform'
import { findDir } from '../utils'
import { type ElementNode, type ForNode, type IfNode, NodeTypes } from '../ast'
import { SET_BLOCK_TRACKING } from '../runtimeHelpers'

const seen = new WeakSet()

// 转换v-once指令
export const transformOnce: NodeTransform = (node, context) => {
  // 如果节点类型是元素节点，且存在v-once指令
  if (node.type === NodeTypes.ELEMENT && findDir(node, 'once', true)) {
    // 如果节点已存在，或已进入v-once，或已进入SSR，则直接return
    if (seen.has(node) || context.inVOnce || context.inSSR) {
      return
    }
    // 将节点添加到seen中
    seen.add(node)
    // 设置inVOnce为true
    context.inVOnce = true
    // 设置helper函数
    context.helper(SET_BLOCK_TRACKING)
    // 返回一个函数
    return () => {
      // 设置inVOnce为false
      context.inVOnce = false
      // 获取当前节点
      const cur = context.currentNode as ElementNode | IfNode | ForNode
      // 如果当前节点有代码生成节点
      if (cur.codegenNode) {
        cur.codegenNode = context.cache(
          cur.codegenNode,
          true /* isVNode */,
          true /* inVOnce */,
        )
      }
    }
  }
}
