// 编译入口
export { baseCompile } from './compile'

// 暴露底层 API 和类型定义
export {
  type CompilerOptions, // 编译器选项类型
  type ParserOptions, // 解析器选项类型
  type TransformOptions, // 转换选项类型
  type CodegenOptions, // 代码生成选项类型
  type HoistTransform, // 提升转换类型
  type BindingMetadata, // 绑定元数据类型
  BindingTypes, // 绑定类型枚举
} from './options'

// 模板解析器
export { baseParse } from './parser'

// AST 转换相关 API 和类型
export {
  transform, // 主转换函数
  type TransformContext, // 转换上下文类型
  createTransformContext, // 创建转换上下文
  traverseNode, // 遍历 AST 节点
  createStructuralDirectiveTransform, // 创建结构化指令转换
  type NodeTransform, // 节点转换类型
  type StructuralDirectiveTransform, // 结构化指令转换类型
  type DirectiveTransform, // 指令转换类型
} from './transform'

// 代码生成相关 API 和类型
export {
  generate, // 代码生成主函数
  type CodegenContext, // 代码生成上下文类型
  type CodegenResult, // 代码生成结果类型
  type CodegenSourceMapGenerator, // 源码映射生成器类型
  type RawSourceMap, // 原始源码映射类型
} from './codegen'

// 错误处理相关 API 和类型
export {
  ErrorCodes, // 错误码枚举
  errorMessages, // 错误信息
  createCompilerError, // 创建编译错误
  type CoreCompilerError, // 核心编译错误类型
  type CompilerError, // 编译错误类型
} from './errors'

// AST 相关导出
export * from './ast'
// 工具函数导出
export * from './utils'
// Babel 相关工具导出
export * from './babelUtils'
// 运行时辅助函数导出
export * from './runtimeHelpers'

// 编译预设相关
export { getBaseTransformPreset, type TransformPreset } from './compile'

// 指令转换相关
export { transformModel } from './transforms/vModel' // v-model 转换
export { transformOn } from './transforms/vOn' // v-on 转换
export { transformBind } from './transforms/vBind' // v-bind 转换
export { noopDirectiveTransform } from './transforms/noopDirectiveTransform' // 空指令转换
export { processIf } from './transforms/vIf' // v-if 处理
export { processFor, createForLoopParams } from './transforms/vFor' // v-for 处理及参数生成

// 表达式相关转换
export {
  transformExpression, // 表达式转换
  processExpression, // 表达式处理
  stringifyExpression, // 表达式字符串化
} from './transforms/transformExpression'

// 插槽相关转换
export {
  buildSlots, // 构建插槽
  type SlotFnBuilder, // 插槽函数构建器类型
  trackVForSlotScopes, // 跟踪 v-for 插槽作用域
  trackSlotScopes, // 跟踪插槽作用域
} from './transforms/vSlot'

// 元素相关转换
export {
  transformElement, // 元素转换
  resolveComponentType, // 解析组件类型
  buildProps, // 构建属性
  buildDirectiveArgs, // 构建指令参数
  type PropsExpression, // 属性表达式类型
} from './transforms/transformElement'

// 插槽出口处理
export { processSlotOutlet } from './transforms/transformSlotOutlet'

// 静态节点缓存相关
export { getConstantType } from './transforms/cacheStatic'

// 代码片段生成工具
export { generateCodeFrame } from '@vue/shared'

// v2 兼容相关，仅限兼容模式
export {
  checkCompatEnabled, // 检查兼容性开关
  warnDeprecation, // 警告废弃用法
  CompilerDeprecationTypes, // 编译器废弃类型
} from './compat/compatConfig'
