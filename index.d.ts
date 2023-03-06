/// <reference path="./plugin-api.d.ts" />

declare global {
  // Global variable with Figma's plugin API.
  const figma: PluginAPI
  const __html__: string
  const __uiFiles__: {
    [key: string]: string
  }
  const console: Console

  // The plugin environment exposes the browser console API,
  // so expected calls like console.log() still work.
  interface Console {
    log(message?: any, ...optionalParams: any[]): void
    error(message?: any, ...optionalParams: any[]): void
    assert(condition?: boolean, message?: string, ...data: any[]): void
    info(message?: any, ...optionalParams: any[]): void
    warn(message?: any, ...optionalParams: any[]): void
    clear(): void
  }
  function setTimeout(callback: Function, timeout: number): number
  function clearTimeout(handle: number): void
  function setInterval(callback: Function, timeout: number): number
  function clearInterval(handle: number): void

  const fetch: (url: string, init?: FetchOptions) => Promise<FetchResponse>

  interface FetchOptions {
    method?: string
    headers?: { [name: string]: string }
    /**
     * @deprecated use headers instead
     */
    headersObject?: { [name: string]: string }
    body?: Uint8Array | string
    credentials?: string
    cache?: string
    redirect?: string
    referrer?: string
    integrity?: string
  }

  interface FetchResponse {
    headersObject: { [name: string]: string }
    ok: boolean
    redirected: boolean
    status: number
    statusText: string
    type: string
    url: string
    arrayBuffer(): Promise<ArrayBuffer>
    text(): Promise<string>
    json(): Promise<any>
  }
} // declare global

export {}
