/// <reference types="vite/client" />

// 既存のImportMetaEnv型を拡張
declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string
    readonly PROD: boolean
    readonly DEV: boolean
    readonly MODE: string
    readonly BASE_URL: string
    readonly SSR: boolean
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

// 画像ファイルのモジュール宣言
declare module '*.png' {
  const value: string
  export default value
}

declare module '*.jpg' {
  const value: string
  export default value
}

declare module '*.jpeg' {
  const value: string
  export default value
}

declare module '*.gif' {
  const value: string
  export default value
}

declare module '*.svg' {
  const value: string
  export default value
}

declare module '*.webp' {
  const value: string
  export default value
}

export {}

