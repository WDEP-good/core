/**
 * 警告函数
 *
 * @type function
 */
export function warn(msg: string, ...args: any[]): void {
  console.warn(`[Vue warn] ${msg}`, ...args)
}
