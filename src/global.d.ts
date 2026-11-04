declare const __DEV__: boolean
declare const __TARGET_BROWSER__: 'chrome' | 'firefox' | 'safari'

declare module '*.vue' {
  const component: any
  export default component
}
