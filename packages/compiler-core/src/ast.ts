import { type PatchFlags, isString } from '@vue/shared'
import {
  CREATE_BLOCK,
  CREATE_ELEMENT_BLOCK,
  CREATE_ELEMENT_VNODE,
  type CREATE_SLOTS,
  CREATE_VNODE,
  type FRAGMENT,
  OPEN_BLOCK,
  type RENDER_LIST,
  type RENDER_SLOT,
  WITH_DIRECTIVES,
  type WITH_MEMO,
} from './runtimeHelpers'
import type { PropsExpression } from './transforms/transformElement'
import type { ImportItem, TransformContext } from './transform'
import type { Node as BabelNode } from '@babel/types'

// Vue 模板是一种与平台无关的、超越 HTML 的超集（仅限语法部分）。
// 各平台特定的编译器还可以声明更多的命名空间。
export type Namespace = number

export enum Namespaces {
  HTML,
  SVG,
  MATH_ML,
}

// 节点类型枚举
export enum NodeTypes {
  ROOT, // 根节点
  ELEMENT, // 元素节点
  TEXT, // 文本节点
  COMMENT, // 注释节点
  SIMPLE_EXPRESSION, // 简单表达式节点
  INTERPOLATION, // 插值表达式节点
  ATTRIBUTE, // 属性节点
  DIRECTIVE, // 指令节点
  // containers
  COMPOUND_EXPRESSION, // 复合表达式节点
  IF, // v-if 节点
  IF_BRANCH, // v-if 分支节点
  FOR, // v-for 节点
  TEXT_CALL, // 文本调用节点
  // codegen
  VNODE_CALL, // vnode 调用节点
  JS_CALL_EXPRESSION, // JS 调用表达式节点
  JS_OBJECT_EXPRESSION, // JS 对象表达式节点
  JS_PROPERTY, // JS 属性节点
  JS_ARRAY_EXPRESSION, // JS 数组表达式节点
  JS_FUNCTION_EXPRESSION, // JS 函数表达式节点
  JS_CONDITIONAL_EXPRESSION, // JS 条件表达式节点
  JS_CACHE_EXPRESSION, // JS 缓存表达式节点

  // ssr codegen
  JS_BLOCK_STATEMENT, // JS 代码块语句节点
  JS_TEMPLATE_LITERAL, // JS 模板字符串节点
  JS_IF_STATEMENT, // JS if 语句节点
  JS_ASSIGNMENT_EXPRESSION, // JS 赋值表达式节点
  JS_SEQUENCE_EXPRESSION, // JS 序列表达式节点
  JS_RETURN_STATEMENT, // JS return 语句节点
}

// 元素类型枚举
export enum ElementTypes {
  ELEMENT, // 元素节点
  COMPONENT, // 组件节点
  SLOT, // 插槽节点
  TEMPLATE, // 模板节点
}

// 节点接口
export interface Node {
  type: NodeTypes // 节点类型
  loc: SourceLocation // 节点位置
}

// 节点范围。`start` 是包含的，`end` 是独占的。
// [start, end)
export interface SourceLocation {
  start: Position // 开始位置
  end: Position // 结束位置
  source: string // 源码
}

// 位置接口
export interface Position {
  offset: number // 从文件开始的位置
  line: number // 行号
  column: number // 列号
}

// 父节点类型
export type ParentNode = RootNode | ElementNode | IfBranchNode | ForNode

// 表达式节点类型
export type ExpressionNode = SimpleExpressionNode | CompoundExpressionNode

// 模板子节点类型
export type TemplateChildNode =
  | ElementNode
  | InterpolationNode
  | CompoundExpressionNode
  | TextNode
  | CommentNode
  | IfNode
  | IfBranchNode
  | ForNode
  | TextCallNode

/**
 * 根节点接口
 * @type: interface
 * @extends: Node
 */
export interface RootNode extends Node {
  type: NodeTypes.ROOT // 节点类型 根节点
  source: string // 源码
  children: TemplateChildNode[] // 子节点
  helpers: Set<symbol> // 帮助函数
  components: string[] // 组件
  directives: string[] // 指令
  hoists: (JSChildNode | null)[] // 提升节点
  imports: ImportItem[] // 导入项
  cached: (CacheExpression | null)[] // 缓存节点
  temps: number // 临时节点
  ssrHelpers?: symbol[] // SSR 帮助函数
  codegenNode?: TemplateChildNode | JSChildNode | BlockStatement // 代码生成节点
  transformed?: boolean // 是否已转换

  // v2 compat only
  filters?: string[] // 过滤器
}

// 元素节点类型
export type ElementNode =
  | PlainElementNode
  | ComponentNode
  | SlotOutletNode
  | TemplateNode

/**
 * 基础元素节点接口
 * @type: interface
 * @extends: Node
 */
export interface BaseElementNode extends Node {
  type: NodeTypes.ELEMENT // 节点类型 元素节点
  ns: Namespace // 命名空间
  tag: string // 标签名
  tagType: ElementTypes // 标签类型
  props: Array<AttributeNode | DirectiveNode> // 属性
  children: TemplateChildNode[] // 子节点
  isSelfClosing?: boolean // 是否自闭合
  innerLoc?: SourceLocation // 仅用于 SFC 根级元素
}

/**
 * 普通元素节点接口
 * @type: interface
 * @extends: BaseElementNode
 */
export interface PlainElementNode extends BaseElementNode {
  tagType: ElementTypes.ELEMENT // 节点类型 元素节点
  codegenNode:
    | VNodeCall // 虚拟节点调用
    | SimpleExpressionNode // 简单表达式节点
    | CacheExpression // 缓存表达式节点
    | MemoExpression // 缓存表达式节点
    | undefined
  ssrCodegenNode?: TemplateLiteral // 模板字符串节点
}

/**
 * 组件节点接口
 * @type: interface
 * @extends: BaseElementNode
 */
export interface ComponentNode extends BaseElementNode {
  tagType: ElementTypes.COMPONENT // 节点类型 组件节点
  codegenNode:
    | VNodeCall // 虚拟节点调用
    | CacheExpression // 缓存表达式节点
    | MemoExpression // 缓存表达式节点
    | undefined // 未定义
  ssrCodegenNode?: CallExpression // 调用表达式节点
}

export interface SlotOutletNode extends BaseElementNode {
  tagType: ElementTypes.SLOT
  codegenNode:
    | RenderSlotCall
    | CacheExpression // when cached by v-once
    | undefined
  ssrCodegenNode?: CallExpression
}

export interface TemplateNode extends BaseElementNode {
  tagType: ElementTypes.TEMPLATE
  // TemplateNode is a container type that always gets compiled away
  codegenNode: undefined
}

export interface TextNode extends Node {
  type: NodeTypes.TEXT
  content: string
}

export interface CommentNode extends Node {
  type: NodeTypes.COMMENT
  content: string
}

export interface AttributeNode extends Node {
  type: NodeTypes.ATTRIBUTE
  name: string
  nameLoc: SourceLocation
  value: TextNode | undefined
}

export interface DirectiveNode extends Node {
  type: NodeTypes.DIRECTIVE
  /**
   * the normalized name without prefix or shorthands, e.g. "bind", "on"
   */
  name: string
  /**
   * the raw attribute name, preserving shorthand, and including arg & modifiers
   * this is only used during parse.
   */
  rawName?: string
  exp: ExpressionNode | undefined
  arg: ExpressionNode | undefined
  modifiers: SimpleExpressionNode[]
  /**
   * optional property to cache the expression parse result for v-for
   */
  forParseResult?: ForParseResult
}

/**
 * Static types have several levels.
 * Higher levels implies lower levels. e.g. a node that can be stringified
 * can always be hoisted and skipped for patch.
 */
export enum ConstantTypes {
  NOT_CONSTANT = 0,
  CAN_SKIP_PATCH,
  CAN_CACHE,
  CAN_STRINGIFY,
}

export interface SimpleExpressionNode extends Node {
  type: NodeTypes.SIMPLE_EXPRESSION
  content: string
  isStatic: boolean
  constType: ConstantTypes
  /**
   * - `null` means the expression is a simple identifier that doesn't need
   *    parsing
   * - `false` means there was a parsing error
   */
  ast?: BabelNode | null | false
  /**
   * Indicates this is an identifier for a hoist vnode call and points to the
   * hoisted node.
   */
  hoisted?: JSChildNode
  /**
   * an expression parsed as the params of a function will track
   * the identifiers declared inside the function body.
   */
  identifiers?: string[]
  isHandlerKey?: boolean
}

export interface InterpolationNode extends Node {
  type: NodeTypes.INTERPOLATION
  content: ExpressionNode
}

export interface CompoundExpressionNode extends Node {
  type: NodeTypes.COMPOUND_EXPRESSION
  /**
   * - `null` means the expression is a simple identifier that doesn't need
   *    parsing
   * - `false` means there was a parsing error
   */
  ast?: BabelNode | null | false
  children: (
    | SimpleExpressionNode
    | CompoundExpressionNode
    | InterpolationNode
    | TextNode
    | string
    | symbol
  )[]

  /**
   * an expression parsed as the params of a function will track
   * the identifiers declared inside the function body.
   */
  identifiers?: string[]
  isHandlerKey?: boolean
}

export interface IfNode extends Node {
  type: NodeTypes.IF
  branches: IfBranchNode[]
  codegenNode?: IfConditionalExpression | CacheExpression // <div v-if v-once>
}

export interface IfBranchNode extends Node {
  type: NodeTypes.IF_BRANCH
  condition: ExpressionNode | undefined // else
  children: TemplateChildNode[]
  userKey?: AttributeNode | DirectiveNode
  isTemplateIf?: boolean
}

export interface ForNode extends Node {
  type: NodeTypes.FOR
  source: ExpressionNode
  valueAlias: ExpressionNode | undefined
  keyAlias: ExpressionNode | undefined
  objectIndexAlias: ExpressionNode | undefined
  parseResult: ForParseResult
  children: TemplateChildNode[]
  codegenNode?: ForCodegenNode
}

export interface ForParseResult {
  source: ExpressionNode
  value: ExpressionNode | undefined
  key: ExpressionNode | undefined
  index: ExpressionNode | undefined
  finalized: boolean
}

export interface TextCallNode extends Node {
  type: NodeTypes.TEXT_CALL
  content: TextNode | InterpolationNode | CompoundExpressionNode
  codegenNode: CallExpression | SimpleExpressionNode // when hoisted
}

export type TemplateTextChildNode =
  | TextNode
  | InterpolationNode
  | CompoundExpressionNode

export interface VNodeCall extends Node {
  type: NodeTypes.VNODE_CALL
  tag: string | symbol | CallExpression
  props: PropsExpression | undefined
  children:
    | TemplateChildNode[] // multiple children
    | TemplateTextChildNode // single text child
    | SlotsExpression // component slots
    | ForRenderListExpression // v-for fragment call
    | SimpleExpressionNode // hoisted
    | CacheExpression // cached
    | undefined
  patchFlag: PatchFlags | undefined
  dynamicProps: string | SimpleExpressionNode | undefined
  directives: DirectiveArguments | undefined
  isBlock: boolean
  disableTracking: boolean
  isComponent: boolean
}

// JS Node Types ---------------------------------------------------------------

// We also include a number of JavaScript AST nodes for code generation.
// The AST is an intentionally minimal subset just to meet the exact needs of
// Vue render function generation.

export type JSChildNode =
  | VNodeCall
  | CallExpression
  | ObjectExpression
  | ArrayExpression
  | ExpressionNode
  | FunctionExpression
  | ConditionalExpression
  | CacheExpression
  | AssignmentExpression
  | SequenceExpression

export interface CallExpression extends Node {
  type: NodeTypes.JS_CALL_EXPRESSION
  callee: string | symbol
  arguments: (
    | string
    | symbol
    | JSChildNode
    | SSRCodegenNode
    | TemplateChildNode
    | TemplateChildNode[]
  )[]
}

export interface ObjectExpression extends Node {
  type: NodeTypes.JS_OBJECT_EXPRESSION
  properties: Array<Property>
}

export interface Property extends Node {
  type: NodeTypes.JS_PROPERTY
  key: ExpressionNode
  value: JSChildNode
}

export interface ArrayExpression extends Node {
  type: NodeTypes.JS_ARRAY_EXPRESSION
  elements: Array<string | Node>
}

export interface FunctionExpression extends Node {
  type: NodeTypes.JS_FUNCTION_EXPRESSION
  params: ExpressionNode | string | (ExpressionNode | string)[] | undefined
  returns?: TemplateChildNode | TemplateChildNode[] | JSChildNode
  body?: BlockStatement | IfStatement
  newline: boolean
  /**
   * This flag is for codegen to determine whether it needs to generate the
   * withScopeId() wrapper
   */
  isSlot: boolean
  /**
   * __COMPAT__ only, indicates a slot function that should be excluded from
   * the legacy $scopedSlots instance property.
   */
  isNonScopedSlot?: boolean
}

export interface ConditionalExpression extends Node {
  type: NodeTypes.JS_CONDITIONAL_EXPRESSION
  test: JSChildNode
  consequent: JSChildNode
  alternate: JSChildNode
  newline: boolean
}

export interface CacheExpression extends Node {
  type: NodeTypes.JS_CACHE_EXPRESSION
  index: number
  value: JSChildNode
  needPauseTracking: boolean
  inVOnce: boolean
  needArraySpread: boolean
}

export interface MemoExpression extends CallExpression {
  callee: typeof WITH_MEMO
  arguments: [ExpressionNode, MemoFactory, string, string]
}

interface MemoFactory extends FunctionExpression {
  returns: BlockCodegenNode
}

// SSR-specific Node Types -----------------------------------------------------

export type SSRCodegenNode =
  | BlockStatement
  | TemplateLiteral
  | IfStatement
  | AssignmentExpression
  | ReturnStatement
  | SequenceExpression

export interface BlockStatement extends Node {
  type: NodeTypes.JS_BLOCK_STATEMENT
  body: (JSChildNode | IfStatement)[]
}

export interface TemplateLiteral extends Node {
  type: NodeTypes.JS_TEMPLATE_LITERAL
  elements: (string | JSChildNode)[]
}

export interface IfStatement extends Node {
  type: NodeTypes.JS_IF_STATEMENT
  test: ExpressionNode
  consequent: BlockStatement
  alternate: IfStatement | BlockStatement | ReturnStatement | undefined
}

export interface AssignmentExpression extends Node {
  type: NodeTypes.JS_ASSIGNMENT_EXPRESSION
  left: SimpleExpressionNode
  right: JSChildNode
}

export interface SequenceExpression extends Node {
  type: NodeTypes.JS_SEQUENCE_EXPRESSION
  expressions: JSChildNode[]
}

export interface ReturnStatement extends Node {
  type: NodeTypes.JS_RETURN_STATEMENT
  returns: TemplateChildNode | TemplateChildNode[] | JSChildNode
}

// Codegen Node Types ----------------------------------------------------------

export interface DirectiveArguments extends ArrayExpression {
  elements: DirectiveArgumentNode[]
}

export interface DirectiveArgumentNode extends ArrayExpression {
  elements: // dir, exp, arg, modifiers
  | [string]
    | [string, ExpressionNode]
    | [string, ExpressionNode, ExpressionNode]
    | [string, ExpressionNode, ExpressionNode, ObjectExpression]
}

// renderSlot(...)
export interface RenderSlotCall extends CallExpression {
  callee: typeof RENDER_SLOT
  arguments: // $slots, name, props, fallback
  | [string, string | ExpressionNode]
    | [string, string | ExpressionNode, PropsExpression]
    | [
        string,
        string | ExpressionNode,
        PropsExpression | '{}',
        TemplateChildNode[],
      ]
}

export type SlotsExpression = SlotsObjectExpression | DynamicSlotsExpression

// { foo: () => [...] }
export interface SlotsObjectExpression extends ObjectExpression {
  properties: SlotsObjectProperty[]
}

export interface SlotsObjectProperty extends Property {
  value: SlotFunctionExpression
}

export interface SlotFunctionExpression extends FunctionExpression {
  returns: TemplateChildNode[] | CacheExpression
}

// createSlots({ ... }, [
//    foo ? () => [] : undefined,
//    renderList(list, i => () => [i])
// ])
export interface DynamicSlotsExpression extends CallExpression {
  callee: typeof CREATE_SLOTS
  arguments: [SlotsObjectExpression, DynamicSlotEntries]
}

export interface DynamicSlotEntries extends ArrayExpression {
  elements: (ConditionalDynamicSlotNode | ListDynamicSlotNode)[]
}

export interface ConditionalDynamicSlotNode extends ConditionalExpression {
  consequent: DynamicSlotNode
  alternate: DynamicSlotNode | SimpleExpressionNode
}

export interface ListDynamicSlotNode extends CallExpression {
  callee: typeof RENDER_LIST
  arguments: [ExpressionNode, ListDynamicSlotIterator]
}

export interface ListDynamicSlotIterator extends FunctionExpression {
  returns: DynamicSlotNode
}

export interface DynamicSlotNode extends ObjectExpression {
  properties: [Property, DynamicSlotFnProperty]
}

export interface DynamicSlotFnProperty extends Property {
  value: SlotFunctionExpression
}

export type BlockCodegenNode = VNodeCall | RenderSlotCall

export interface IfConditionalExpression extends ConditionalExpression {
  consequent: BlockCodegenNode | MemoExpression
  alternate: BlockCodegenNode | IfConditionalExpression | MemoExpression
}

export interface ForCodegenNode extends VNodeCall {
  isBlock: true
  tag: typeof FRAGMENT
  props: undefined
  children: ForRenderListExpression
  patchFlag: PatchFlags
  disableTracking: boolean
}

export interface ForRenderListExpression extends CallExpression {
  callee: typeof RENDER_LIST
  arguments: [ExpressionNode, ForIteratorExpression]
}

export interface ForIteratorExpression extends FunctionExpression {
  returns?: BlockCodegenNode
}

// AST Utilities ---------------------------------------------------------------

// Some expressions, e.g. sequence and conditional expressions, are never
// associated with template nodes, so their source locations are just a stub.
// Container types like CompoundExpression also don't need a real location.
export const locStub: SourceLocation = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
  source: '',
}

export function createRoot(
  children: TemplateChildNode[],
  source = '',
): RootNode {
  return {
    type: NodeTypes.ROOT,
    source,
    children,
    helpers: new Set(),
    components: [],
    directives: [],
    hoists: [],
    imports: [],
    cached: [],
    temps: 0,
    codegenNode: undefined,
    loc: locStub,
  }
}

export function createVNodeCall(
  context: TransformContext | null,
  tag: VNodeCall['tag'],
  props?: VNodeCall['props'],
  children?: VNodeCall['children'],
  patchFlag?: VNodeCall['patchFlag'],
  dynamicProps?: VNodeCall['dynamicProps'],
  directives?: VNodeCall['directives'],
  isBlock: VNodeCall['isBlock'] = false,
  disableTracking: VNodeCall['disableTracking'] = false,
  isComponent: VNodeCall['isComponent'] = false,
  loc: SourceLocation = locStub,
): VNodeCall {
  if (context) {
    if (isBlock) {
      context.helper(OPEN_BLOCK)
      context.helper(getVNodeBlockHelper(context.inSSR, isComponent))
    } else {
      context.helper(getVNodeHelper(context.inSSR, isComponent))
    }
    if (directives) {
      context.helper(WITH_DIRECTIVES)
    }
  }

  return {
    type: NodeTypes.VNODE_CALL,
    tag,
    props,
    children,
    patchFlag,
    dynamicProps,
    directives,
    isBlock,
    disableTracking,
    isComponent,
    loc,
  }
}

export function createArrayExpression(
  elements: ArrayExpression['elements'],
  loc: SourceLocation = locStub,
): ArrayExpression {
  return {
    type: NodeTypes.JS_ARRAY_EXPRESSION,
    loc,
    elements,
  }
}

export function createObjectExpression(
  properties: ObjectExpression['properties'],
  loc: SourceLocation = locStub,
): ObjectExpression {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    loc,
    properties,
  }
}

export function createObjectProperty(
  key: Property['key'] | string,
  value: Property['value'],
): Property {
  return {
    type: NodeTypes.JS_PROPERTY,
    loc: locStub,
    key: isString(key) ? createSimpleExpression(key, true) : key,
    value,
  }
}

export function createSimpleExpression(
  content: SimpleExpressionNode['content'],
  isStatic: SimpleExpressionNode['isStatic'] = false,
  loc: SourceLocation = locStub,
  constType: ConstantTypes = ConstantTypes.NOT_CONSTANT,
): SimpleExpressionNode {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc,
    content,
    isStatic,
    constType: isStatic ? ConstantTypes.CAN_STRINGIFY : constType,
  }
}

export function createInterpolation(
  content: InterpolationNode['content'] | string,
  loc: SourceLocation,
): InterpolationNode {
  return {
    type: NodeTypes.INTERPOLATION,
    loc,
    content: isString(content)
      ? createSimpleExpression(content, false, loc)
      : content,
  }
}

export function createCompoundExpression(
  children: CompoundExpressionNode['children'],
  loc: SourceLocation = locStub,
): CompoundExpressionNode {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    loc,
    children,
  }
}

type InferCodegenNodeType<T> = T extends typeof RENDER_SLOT
  ? RenderSlotCall
  : CallExpression

export function createCallExpression<T extends CallExpression['callee']>(
  callee: T,
  args: CallExpression['arguments'] = [],
  loc: SourceLocation = locStub,
): InferCodegenNodeType<T> {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee,
    arguments: args,
  } as InferCodegenNodeType<T>
}

export function createFunctionExpression(
  params: FunctionExpression['params'],
  returns: FunctionExpression['returns'] = undefined,
  newline: boolean = false,
  isSlot: boolean = false,
  loc: SourceLocation = locStub,
): FunctionExpression {
  return {
    type: NodeTypes.JS_FUNCTION_EXPRESSION,
    params,
    returns,
    newline,
    isSlot,
    loc,
  }
}

export function createConditionalExpression(
  test: ConditionalExpression['test'],
  consequent: ConditionalExpression['consequent'],
  alternate: ConditionalExpression['alternate'],
  newline = true,
): ConditionalExpression {
  return {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent,
    alternate,
    newline,
    loc: locStub,
  }
}

export function createCacheExpression(
  index: number,
  value: JSChildNode,
  needPauseTracking: boolean = false,
  inVOnce: boolean = false,
): CacheExpression {
  return {
    type: NodeTypes.JS_CACHE_EXPRESSION,
    index,
    value,
    needPauseTracking: needPauseTracking,
    inVOnce,
    needArraySpread: false,
    loc: locStub,
  }
}

export function createBlockStatement(
  body: BlockStatement['body'],
): BlockStatement {
  return {
    type: NodeTypes.JS_BLOCK_STATEMENT,
    body,
    loc: locStub,
  }
}

export function createTemplateLiteral(
  elements: TemplateLiteral['elements'],
): TemplateLiteral {
  return {
    type: NodeTypes.JS_TEMPLATE_LITERAL,
    elements,
    loc: locStub,
  }
}

export function createIfStatement(
  test: IfStatement['test'],
  consequent: IfStatement['consequent'],
  alternate?: IfStatement['alternate'],
): IfStatement {
  return {
    type: NodeTypes.JS_IF_STATEMENT,
    test,
    consequent,
    alternate,
    loc: locStub,
  }
}

export function createAssignmentExpression(
  left: AssignmentExpression['left'],
  right: AssignmentExpression['right'],
): AssignmentExpression {
  return {
    type: NodeTypes.JS_ASSIGNMENT_EXPRESSION,
    left,
    right,
    loc: locStub,
  }
}

export function createSequenceExpression(
  expressions: SequenceExpression['expressions'],
): SequenceExpression {
  return {
    type: NodeTypes.JS_SEQUENCE_EXPRESSION,
    expressions,
    loc: locStub,
  }
}

export function createReturnStatement(
  returns: ReturnStatement['returns'],
): ReturnStatement {
  return {
    type: NodeTypes.JS_RETURN_STATEMENT,
    returns,
    loc: locStub,
  }
}

export function getVNodeHelper(
  ssr: boolean,
  isComponent: boolean,
): typeof CREATE_VNODE | typeof CREATE_ELEMENT_VNODE {
  return ssr || isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE
}

export function getVNodeBlockHelper(
  ssr: boolean,
  isComponent: boolean,
): typeof CREATE_BLOCK | typeof CREATE_ELEMENT_BLOCK {
  return ssr || isComponent ? CREATE_BLOCK : CREATE_ELEMENT_BLOCK
}

export function convertToBlock(
  node: VNodeCall,
  { helper, removeHelper, inSSR }: TransformContext,
): void {
  if (!node.isBlock) {
    node.isBlock = true
    removeHelper(getVNodeHelper(inSSR, node.isComponent))
    helper(OPEN_BLOCK)
    helper(getVNodeBlockHelper(inSSR, node.isComponent))
  }
}
