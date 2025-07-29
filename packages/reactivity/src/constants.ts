// using literal strings instead of numbers so that it's easier to inspect
// 使用字面量字符串而不是数字，这样更容易检查
// debugger events
// 调试器事件

// 监听器类型
export enum TrackOpTypes {
  GET = 'get', // 获取属性值操作，当访问响应式对象的属性时触发
  HAS = 'has', // 检查属性存在性操作，当使用 in 操作符或 hasOwnProperty 时触发
  ITERATE = 'iterate', // 迭代操作，当遍历对象属性时触发（如 for...in 循环）
}

// 派发器类型
export enum TriggerOpTypes {
  SET = 'set', // 设置属性值操作，当修改响应式对象的属性时触发
  ADD = 'add', // 添加属性操作，当向响应式对象添加新属性时触发
  DELETE = 'delete', // 删除属性操作，当删除响应式对象的属性时触发
  CLEAR = 'clear', // 清空操作，当清空集合（如 Map、Set）时触发
}

// 响应式标志
export enum ReactiveFlags {
  SKIP = '__v_skip', // 跳过响应式处理，标记对象不需要响应式转换
  IS_REACTIVE = '__v_isReactive', // 标记对象是否为响应式对象
  IS_READONLY = '__v_isReadonly', // 标记对象是否为只读响应式对象
  IS_SHALLOW = '__v_isShallow', // 标记对象是否为浅层响应式对象（只转换第一层属性）
  RAW = '__v_raw', // 存储原始对象，用于获取未经过响应式包装的原始值
  IS_REF = '__v_isRef', // 标记对象是否为 ref 对象
}
