import type { CSSProperties } from 'vue'

// Safari 中根元素的 overflow 切换（滚动锁）后，content-visibility: auto 的元素会一直不绘制，所以只保留它施加的约束
export const skippableContentStyle: CSSProperties = __TARGET_BROWSER__ === 'safari'
  ? { contain: 'layout style paint' }
  : { contentVisibility: 'auto' }
