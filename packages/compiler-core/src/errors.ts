import type { SourceLocation } from './ast'

/**
 * 编译器错误接口
 * @type: interface
 * @extends: SyntaxError
 */
export interface CompilerError extends SyntaxError {
  code: number | string
  loc?: SourceLocation
}

/**
 * 收缩类型core编译错误接口
 * @type: interface
 * @extends: CompilerError
 */
export interface CoreCompilerError extends CompilerError {
  code: ErrorCodes
}

/**
 * 默认错误处理方法
 * @type: function
 */
export function defaultOnError(error: CompilerError): never {
  throw error
}
/**
 * 默认警告处理方法
 * @type: function
 */
export function defaultOnWarn(msg: CompilerError): void {
  __DEV__ && console.warn(`[Vue warn] ${msg.message}`)
}

/**
 * 编译错误接口
 * @type: interface
 */
type InferCompilerError<T> = T extends ErrorCodes
  ? CoreCompilerError
  : CompilerError

/**
 * 创建编译错误方法
 * @type: function
 * @param: code: 错误码
 * @param: loc: 错误位置
 * @param: messages: 错误信息
 * @param: additionalMessage: 额外信息
 * @returns: 编译错误
 */
export function createCompilerError<T extends number>(
  code: T,
  loc?: SourceLocation,
  messages?: { [code: number]: string },
  additionalMessage?: string,
): InferCompilerError<T> {
  // 开发环境或非浏览器环境，使用错误信息
  const msg =
    __DEV__ || !__BROWSER__
      ? (messages || errorMessages)[code] + (additionalMessage || ``)
      : `https://vuejs.org/error-reference/#compiler-${code}`
  // 创建编译错误
  const error = new SyntaxError(String(msg)) as InferCompilerError<T>
  // 设置错误码
  error.code = code
  // 设置错误位置
  error.loc = loc
  // 返回编译错误
  return error
}

// 错误码枚举
export enum ErrorCodes {
  // 解析错误
  ABRUPT_CLOSING_OF_EMPTY_COMMENT, // 非法的空注释结尾
  CDATA_IN_HTML_CONTENT, // HTML内容中出现CDATA，仅允许在XML中
  DUPLICATE_ATTRIBUTE, // 属性重复
  END_TAG_WITH_ATTRIBUTES, // 结束标签不允许有属性
  END_TAG_WITH_TRAILING_SOLIDUS, // 结束标签中出现非法的'/'
  EOF_BEFORE_TAG_NAME, // 标签名前遇到文件结尾
  EOF_IN_CDATA, // CDATA段中遇到文件结尾
  EOF_IN_COMMENT, // 注释中遇到文件结尾
  EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT, // script标签中注释样式文本遇到文件结尾
  EOF_IN_TAG, // 标签中遇到文件结尾
  INCORRECTLY_CLOSED_COMMENT, // 注释关闭方式不正确
  INCORRECTLY_OPENED_COMMENT, // 注释开启方式不正确
  INVALID_FIRST_CHARACTER_OF_TAG_NAME, // 标签名首字符非法
  MISSING_ATTRIBUTE_VALUE, // 属性缺少值
  MISSING_END_TAG_NAME, // 结束标签缺少标签名
  MISSING_WHITESPACE_BETWEEN_ATTRIBUTES, // 属性之间缺少空格
  NESTED_COMMENT, // 注释嵌套
  UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME, // 属性名中出现非法字符
  UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE, // 非引号包裹的属性值中出现非法字符
  UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME, // 属性名前出现等号
  UNEXPECTED_NULL_CHARACTER, // 出现意外的空字符
  UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME, // 标签名处出现问号
  UNEXPECTED_SOLIDUS_IN_TAG, // 标签中出现非法的'/'

  // Vue特有的解析错误
  X_INVALID_END_TAG, // 非法的结束标签
  X_MISSING_END_TAG, // 元素缺少结束标签
  X_MISSING_INTERPOLATION_END, // 插值表达式缺少结束符
  X_MISSING_DIRECTIVE_NAME, // 指令缺少名称
  X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END, // 动态指令参数缺少结束括号

  // 转换阶段错误
  X_V_IF_NO_EXPRESSION, // v-if/v-else-if 缺少表达式
  X_V_IF_SAME_KEY, // v-if/else 分支必须使用唯一的key
  X_V_ELSE_NO_ADJACENT_IF, // v-else/v-else-if 没有相邻的 v-if 或 v-else-if
  X_V_FOR_NO_EXPRESSION, // v-for 缺少表达式
  X_V_FOR_MALFORMED_EXPRESSION, // v-for 表达式格式错误
  X_V_FOR_TEMPLATE_KEY_PLACEMENT, // v-for 的 key 放置在 template 上
  X_V_BIND_NO_EXPRESSION, // v-bind 缺少表达式
  X_V_ON_NO_EXPRESSION, // v-on 缺少表达式
  X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET, // slot outlet 上出现了意外的指令
  X_V_SLOT_MIXED_SLOT_USAGE, // slot 用法混合
  X_V_SLOT_DUPLICATE_SLOT_NAMES, // slot 名称重复
  X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN, // 默认插槽有多余的子节点
  X_V_SLOT_MISPLACED, // slot 用法位置不正确
  X_V_MODEL_NO_EXPRESSION, // v-model 缺少表达式
  X_V_MODEL_MALFORMED_EXPRESSION, // v-model 表达式格式错误
  X_V_MODEL_ON_SCOPE_VARIABLE, // v-model 用在作用域变量上
  X_V_MODEL_ON_PROPS, // v-model 用在 props 上
  X_INVALID_EXPRESSION, // 表达式非法
  X_KEEP_ALIVE_INVALID_CHILDREN, // keep-alive 的子节点非法

  // 通用错误
  X_PREFIX_ID_NOT_SUPPORTED, // 不支持 prefixId
  X_MODULE_MODE_NOT_SUPPORTED, // 不支持 module 模式
  X_CACHE_HANDLER_NOT_SUPPORTED, // 不支持缓存处理器
  X_SCOPE_ID_NOT_SUPPORTED, // 不支持 scopeId
  X_VNODE_HOOKS, // vnode hooks 错误

  // 保持当前小版本顺序
  // TODO: 3.5版本调整顺序
  X_V_BIND_INVALID_SAME_NAME_ARGUMENT, // v-bind 出现同名参数非法

  // 供高阶编译器使用的特殊值，用于获取最后一个错误码，避免冲突。始终保持为最后一项。
  __EXTEND_POINT__,
}

// 具体错误信息
export const errorMessages: Record<ErrorCodes, string> = {
  // parse errors
  [ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT]: 'Illegal comment.',
  [ErrorCodes.CDATA_IN_HTML_CONTENT]:
    'CDATA section is allowed only in XML context.',
  [ErrorCodes.DUPLICATE_ATTRIBUTE]: 'Duplicate attribute.',
  [ErrorCodes.END_TAG_WITH_ATTRIBUTES]: 'End tag cannot have attributes.',
  [ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS]: "Illegal '/' in tags.",
  [ErrorCodes.EOF_BEFORE_TAG_NAME]: 'Unexpected EOF in tag.',
  [ErrorCodes.EOF_IN_CDATA]: 'Unexpected EOF in CDATA section.',
  [ErrorCodes.EOF_IN_COMMENT]: 'Unexpected EOF in comment.',
  [ErrorCodes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT]:
    'Unexpected EOF in script.',
  [ErrorCodes.EOF_IN_TAG]: 'Unexpected EOF in tag.',
  [ErrorCodes.INCORRECTLY_CLOSED_COMMENT]: 'Incorrectly closed comment.',
  [ErrorCodes.INCORRECTLY_OPENED_COMMENT]: 'Incorrectly opened comment.',
  [ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME]:
    "Illegal tag name. Use '&lt;' to print '<'.",
  [ErrorCodes.MISSING_ATTRIBUTE_VALUE]: 'Attribute value was expected.',
  [ErrorCodes.MISSING_END_TAG_NAME]: 'End tag name was expected.',
  [ErrorCodes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES]:
    'Whitespace was expected.',
  [ErrorCodes.NESTED_COMMENT]: "Unexpected '<!--' in comment.",
  [ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME]:
    'Attribute name cannot contain U+0022 ("), U+0027 (\'), and U+003C (<).',
  [ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE]:
    'Unquoted attribute value cannot contain U+0022 ("), U+0027 (\'), U+003C (<), U+003D (=), and U+0060 (`).',
  [ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME]:
    "Attribute name cannot start with '='.",
  [ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME]:
    "'<?' is allowed only in XML context.",
  [ErrorCodes.UNEXPECTED_NULL_CHARACTER]: `Unexpected null character.`,
  [ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG]: "Illegal '/' in tags.",

  // Vue-specific parse errors
  [ErrorCodes.X_INVALID_END_TAG]: 'Invalid end tag.',
  [ErrorCodes.X_MISSING_END_TAG]: 'Element is missing end tag.',
  [ErrorCodes.X_MISSING_INTERPOLATION_END]:
    'Interpolation end sign was not found.',
  [ErrorCodes.X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END]:
    'End bracket for dynamic directive argument was not found. ' +
    'Note that dynamic directive argument cannot contain spaces.',
  [ErrorCodes.X_MISSING_DIRECTIVE_NAME]: 'Legal directive name was expected.',

  // transform errors: 编译阶段错误
  [ErrorCodes.X_V_IF_NO_EXPRESSION]: `v-if/v-else-if is missing expression.`,
  [ErrorCodes.X_V_IF_SAME_KEY]: `v-if/else branches must use unique keys.`,
  [ErrorCodes.X_V_ELSE_NO_ADJACENT_IF]: `v-else/v-else-if has no adjacent v-if or v-else-if.`,
  [ErrorCodes.X_V_FOR_NO_EXPRESSION]: `v-for is missing expression.`,
  [ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION]: `v-for has invalid expression.`,
  [ErrorCodes.X_V_FOR_TEMPLATE_KEY_PLACEMENT]: `<template v-for> key should be placed on the <template> tag.`,
  [ErrorCodes.X_V_BIND_NO_EXPRESSION]: `v-bind is missing expression.`,
  [ErrorCodes.X_V_BIND_INVALID_SAME_NAME_ARGUMENT]: `v-bind with same-name shorthand only allows static argument.`,
  [ErrorCodes.X_V_ON_NO_EXPRESSION]: `v-on is missing expression.`,
  [ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET]: `Unexpected custom directive on <slot> outlet.`,
  [ErrorCodes.X_V_SLOT_MIXED_SLOT_USAGE]:
    `Mixed v-slot usage on both the component and nested <template>. ` +
    `When there are multiple named slots, all slots should use <template> ` +
    `syntax to avoid scope ambiguity.`,
  [ErrorCodes.X_V_SLOT_DUPLICATE_SLOT_NAMES]: `Duplicate slot names found. `,
  [ErrorCodes.X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN]:
    `Extraneous children found when component already has explicitly named ` +
    `default slot. These children will be ignored.`,
  [ErrorCodes.X_V_SLOT_MISPLACED]: `v-slot can only be used on components or <template> tags.`,
  [ErrorCodes.X_V_MODEL_NO_EXPRESSION]: `v-model is missing expression.`,
  [ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION]: `v-model value must be a valid JavaScript member expression.`,
  [ErrorCodes.X_V_MODEL_ON_SCOPE_VARIABLE]: `v-model cannot be used on v-for or v-slot scope variables because they are not writable.`,
  [ErrorCodes.X_V_MODEL_ON_PROPS]: `v-model cannot be used on a prop, because local prop bindings are not writable.\nUse a v-bind binding combined with a v-on listener that emits update:x event instead.`,
  [ErrorCodes.X_INVALID_EXPRESSION]: `Error parsing JavaScript expression: `,
  [ErrorCodes.X_KEEP_ALIVE_INVALID_CHILDREN]: `<KeepAlive> expects exactly one child component.`,
  [ErrorCodes.X_VNODE_HOOKS]: `@vnode-* hooks in templates are no longer supported. Use the vue: prefix instead. For example, @vnode-mounted should be changed to @vue:mounted. @vnode-* hooks support has been removed in 3.4.`,

  // generic errors
  [ErrorCodes.X_PREFIX_ID_NOT_SUPPORTED]: `"prefixIdentifiers" option is not supported in this build of compiler.`,
  [ErrorCodes.X_MODULE_MODE_NOT_SUPPORTED]: `ES module mode is not supported in this build of compiler.`,
  [ErrorCodes.X_CACHE_HANDLER_NOT_SUPPORTED]: `"cacheHandlers" option is only supported when the "prefixIdentifiers" option is enabled.`,
  [ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED]: `"scopeId" option is only supported in module mode.`,

  // just to fulfill types
  [ErrorCodes.__EXTEND_POINT__]: ``,
}
