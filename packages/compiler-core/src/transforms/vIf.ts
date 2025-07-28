import {
  type NodeTransform,
  type TransformContext,
  createStructuralDirectiveTransform,
  traverseNode,
} from '../transform'
import {
  type AttributeNode,
  type BlockCodegenNode,
  type CacheExpression,
  ConstantTypes,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type IfBranchNode,
  type IfConditionalExpression,
  type IfNode,
  type MemoExpression,
  NodeTypes,
  type SimpleExpressionNode,
  convertToBlock,
  createCallExpression,
  createConditionalExpression,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
  createVNodeCall,
  locStub,
} from '../ast'
import { ErrorCodes, createCompilerError } from '../errors'
import { processExpression } from './transformExpression'
import { validateBrowserExpression } from '../validateExpression'
import { cloneLoc } from '../parser'
import { CREATE_COMMENT, FRAGMENT } from '../runtimeHelpers'
import { findDir, findProp, getMemoedVNodeCall, injectProp } from '../utils'
import { PatchFlags } from '@vue/shared'

/**
 * 转换 v-if 指令
 * @type: function
 * @param: node: 节点
 * @param: dir: 指令
 * @param: context: 上下文
 */
export const transformIf: NodeTransform = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      // #1587: We need to dynamically increment the key based on the current
      // node's sibling nodes, since chained v-if/else branches are
      // rendered at the same depth
      const siblings = context.parent!.children
      let i = siblings.indexOf(ifNode)
      let key = 0
      while (i-- >= 0) {
        const sibling = siblings[i]
        if (sibling && sibling.type === NodeTypes.IF) {
          key += sibling.branches.length
        }
      }

      // Exit callback. Complete the codegenNode when all children have been
      // transformed.
      return () => {
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(
            branch,
            key,
            context,
          ) as IfConditionalExpression
        } else {
          // attach this branch's codegen node to the v-if root.
          const parentCondition = getParentCondition(ifNode.codegenNode!)
          parentCondition.alternate = createCodegenNodeForBranch(
            branch,
            key + ifNode.branches.length - 1,
            context,
          )
        }
      }
    })
  },
)

/**
 * 用于客户端和服务器端的与目标无关的转换操作
 * @type function
 * @param node: 节点
 * @param dir: 指令
 * @param context: 上下文
 * @param processCodegen: 处理代码生成
 * @returns: 处理代码生成
 */
export function processIf(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (
    node: IfNode,
    branch: IfBranchNode,
    isRoot: boolean,
  ) => (() => void) | undefined,
): (() => void) | undefined {
  // 如果指令不是 else 且没有表达式或表达式为空，则抛出错误
  if (
    dir.name !== 'else' &&
    (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim())
  ) {
    // 获取报错节点位置，如果存在表达式，则使用表达式位置，否则使用节点位置
    const loc = dir.exp ? dir.exp.loc : node.loc
    // 抛出错误
    context.onError(
      // 创建编译错误——V-if 没有表达式，使用 指令 位置
      createCompilerError(ErrorCodes.X_V_IF_NO_EXPRESSION, dir.loc),
    )
    // 创建一个true的if表达式，用于默认值
    dir.exp = createSimpleExpression(`true`, false, loc)
  }

  // 处理表达式前缀
  if (!__BROWSER__ && context.prefixIdentifiers && dir.exp) {
    // dir.exp 只能是一个简单的表达式，因为 vIf 转换是在表达式转换之前应用的。
    dir.exp = processExpression(dir.exp as SimpleExpressionNode, context)
  }

  // 验证指令表达式
  if (__DEV__ && __BROWSER__ && dir.exp) {
    validateBrowserExpression(dir.exp as SimpleExpressionNode, context)
  }

  // 创建节点
  // 如果指令是 if，则创建 if 分支
  if (dir.name === 'if') {
    // 创建if分支
    const branch = createIfBranch(node, dir)
    // 创建if节点
    const ifNode: IfNode = {
      type: NodeTypes.IF,
      loc: cloneLoc(node.loc),
      branches: [branch],
    }
    // 替换节点
    context.replaceNode(ifNode)
    // 如果存在处理代码生成，则返回处理代码生成
    if (processCodegen) {
      return processCodegen(ifNode, branch, true)
    }
  } else {
    // 有可能是el-if，或else，所以要获取相邻的if节点
    // 获取父节点子节点
    const siblings = context.parent!.children
    // 获取注释节点
    const comments = []
    // 获取节点索引
    let i = siblings.indexOf(node)
    // 遍历节点，因为el-if或else可能存在多个，所以需要遍历，从下往上遍历
    while (i-- >= -1) {
      // 获取相邻节点
      const sibling = siblings[i]
      // 如果相邻节点是注释节点，则移除注释节点
      if (sibling && sibling.type === NodeTypes.COMMENT) {
        // 移除注释节点
        context.removeNode(sibling)
        // 如果开发环境，则将注释节点添加到注释节点数组中
        __DEV__ && comments.unshift(sibling)
        continue
      }
      // 如果相邻节点是文本节点，则移除文本节点
      if (
        sibling &&
        sibling.type === NodeTypes.TEXT &&
        !sibling.content.trim().length
      ) {
        // 移除文本节点
        context.removeNode(sibling)
        continue
      }
      // 如果相邻节点是if节点，则检查v-else是否跟随v-else-if或两个相邻的v-else
      if (sibling && sibling.type === NodeTypes.IF) {
        // 如果指令是else-if或else，且相邻的if分支没有条件，则抛出错误
        if (
          (dir.name === 'else-if' || dir.name === 'else') &&
          sibling.branches[sibling.branches.length - 1].condition === undefined
        ) {
          // 抛出错误
          context.onError(
            createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc),
          )
        }

        // 将该节点移动至“if”节点的分支处
        // 移除节点
        context.removeNode()
        // 创建if分支
        const branch = createIfBranch(node, dir)
        // 如果开发环境，且有注释节点，且父节点是元素节点，且父节点标签是transition或Transition，则忽略注释节点
        if (
          __DEV__ &&
          comments.length &&
          // #3619 ignore comments if the v-if is direct child of <transition>
          !(
            context.parent &&
            context.parent.type === NodeTypes.ELEMENT &&
            (context.parent.tag === 'transition' ||
              context.parent.tag === 'Transition')
          )
        ) {
          branch.children = [...comments, ...branch.children]
        }

        // 检查用户是否在不同的分支上强制使用相同的键
        if (__DEV__ || !__BROWSER__) {
          // 获取用户键
          const key = branch.userKey
          // 如果用户键存在，则遍历相邻的if分支
          if (key) {
            // 遍历相邻的if分支
            sibling.branches.forEach(({ userKey }) => {
              if (isSameKey(userKey, key)) {
                // 如果有相同的key就抛出错误
                context.onError(
                  createCompilerError(
                    ErrorCodes.X_V_IF_SAME_KEY,
                    branch.userKey!.loc,
                  ),
                )
              }
            })
          }
        }

        // 将if分支添加到相邻的if节点
        sibling.branches.push(branch)
        // 如果存在处理代码生成，则返回处理代码生成
        const onExit = processCodegen && processCodegen(sibling, branch, false)
        // 因为分支被移除了，所以不会被遍历。确保在这里遍历。
        // make sure to traverse here.
        traverseNode(branch, context)
        // 调用退出
        if (onExit) onExit()
        // 确保在遍历后重置currentNode以指示此节点已移除。
        //  在遍历完成后务必重置当前节点，以表明此节点已被移除。
        context.currentNode = null
      } else {
        // 抛出错误
        context.onError(
          createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc),
        )
      }
      // 结束循环
      break
    }
  }
}

/**
 * 创建if分支
 * @type function
 */
function createIfBranch(node: ElementNode, dir: DirectiveNode): IfBranchNode {
  // 判断是否是模板节点
  const isTemplateIf = node.tagType === ElementTypes.TEMPLATE
  // 返回if分支节点
  // children：如果节点是模板节点，且没有for指令，则使用节点子节点，否则使用节点
  // userKey：获取节点key属性
  return {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: dir.name === 'else' ? undefined : dir.exp,
    children: isTemplateIf && !findDir(node, 'for') ? node.children : [node],
    userKey: findProp(node, `key`),
    isTemplateIf,
  }
}

/**
 * 创建if分支的代码生成节点
 * @type function
 */
function createCodegenNodeForBranch(
  branch: IfBranchNode,
  keyIndex: number,
  context: TransformContext,
): IfConditionalExpression | BlockCodegenNode | MemoExpression {
  // 如果分支有条件，则创建条件表达式
  if (branch.condition) {
    // 创建条件表达式
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, keyIndex, context),
      // 确保传递 asBlock: true 以便注释节点调用关闭当前块。
      createCallExpression(context.helper(CREATE_COMMENT), [
        __DEV__ ? '"v-if"' : '""',
        'true',
      ]),
    ) as IfConditionalExpression
  } else {
    // 如果分支没有条件，则创建子节点代码生成节点
    return createChildrenCodegenNode(branch, keyIndex, context)
  }
}

/**
 * 创建子节点代码生成节点
 * @type function
 */
function createChildrenCodegenNode(
  branch: IfBranchNode,
  keyIndex: number,
  context: TransformContext,
): BlockCodegenNode | MemoExpression {
  // 获取上下文辅助函数
  const { helper } = context
  // 创建key属性
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(
      `${keyIndex}`,
      false,
      locStub,
      ConstantTypes.CAN_CACHE,
    ),
  )
  // 获取子节点
  const { children } = branch
  // 获取第一个子节点
  const firstChild = children[0]
  // 判断是否需要包裹在fragment中
  const needFragmentWrapper =
    children.length !== 1 || firstChild.type !== NodeTypes.ELEMENT
  // 如果需要包裹在fragment中
  if (needFragmentWrapper) {
    // 如果子节点只有一个，且子节点是for节点，则优化掉嵌套的fragment
    if (children.length === 1 && firstChild.type === NodeTypes.FOR) {
      // 注入key属性
      const vnodeCall = firstChild.codegenNode!
      injectProp(vnodeCall, keyProperty, context)
      return vnodeCall
    } else {
      // 创建patchFlag
      let patchFlag = PatchFlags.STABLE_FRAGMENT
      // 如果开发环境，且不是模板节点，且子节点只有一个，且子节点是注释节点，则设置patchFlag为开发根片段
      if (
        __DEV__ &&
        !branch.isTemplateIf &&
        children.filter(c => c.type !== NodeTypes.COMMENT).length === 1
      ) {
        // 设置patchFlag为开发根片段
        patchFlag |= PatchFlags.DEV_ROOT_FRAGMENT
      }
      // 创建虚拟节点调用
      return createVNodeCall(
        context,
        helper(FRAGMENT),
        createObjectExpression([keyProperty]),
        children,
        patchFlag,
        undefined,
        undefined,
        true,
        false,
        false /* isComponent */,
        branch.loc,
      )
    }
  } else {
    // 获取第一个子节点的代码生成节点
    const ret = (firstChild as ElementNode).codegenNode as
      | BlockCodegenNode
      | MemoExpression
    // 获取虚拟节点调用
    const vnodeCall = getMemoedVNodeCall(ret)
    // 将createVNode转换为createBlock
    if (vnodeCall.type === NodeTypes.VNODE_CALL) {
      convertToBlock(vnodeCall, context)
    }
    // 注入分支key
    injectProp(vnodeCall, keyProperty, context)
    // 返回ret
    return ret
  }
}

/**
 * 检查两个节点是否具有相同的键
 * @type function
 */
function isSameKey(
  a: AttributeNode | DirectiveNode | undefined,
  b: AttributeNode | DirectiveNode,
): boolean {
  // 如果a或b不存在，或a的类型与b的类型不匹配，则返回false
  if (!a || a.type !== b.type) {
    return false
  }
  // 如果a的类型是属性节点
  if (a.type === NodeTypes.ATTRIBUTE) {
    // 如果a的值与b的值不匹配，则返回false
    if (a.value!.content !== (b as AttributeNode).value!.content) {
      return false
    }
  } else {
    // 如果a的类型是指令节点
    const exp = a.exp!
    const branchExp = (b as DirectiveNode).exp!
    // 如果a的表达式类型与b的表达式类型不匹配，则返回false
    if (exp.type !== branchExp.type) {
      return false
    }
    // 如果a的表达式类型是简单表达式，且a的表达式类型与b的表达式类型不匹配，则返回false
    if (
      exp.type !== NodeTypes.SIMPLE_EXPRESSION ||
      exp.isStatic !== (branchExp as SimpleExpressionNode).isStatic ||
      exp.content !== (branchExp as SimpleExpressionNode).content
    ) {
      return false
    }
  }
  // 如果a的值与b的值匹配，则返回true
  return true
}

/**
 * 获取父条件
 * @type function
 */
function getParentCondition(
  node: IfConditionalExpression | CacheExpression,
): IfConditionalExpression {
  // 如果node的类型是条件表达式
  while (true) {
    // 如果node的类型是条件表达式
    if (node.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
      // 如果node的类型是条件表达式
      if (node.alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION) {
        // 将node的值赋值给node
        node = node.alternate
      } else {
        // 如果node的类型是条件表达式，则返回node
        return node
      }
    } else if (node.type === NodeTypes.JS_CACHE_EXPRESSION) {
      // 如果node的类型是缓存表达式，则将node的值赋值给node
      node = node.value as IfConditionalExpression
    }
  }
}
