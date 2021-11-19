// Figma Plugin API version 1, update 39
/// <reference path="./plugin-api" />

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
  function setTimeout(callback: Function, timeout: number): number;
  function clearTimeout(handle: number): void;
  function setInterval(callback: Function, timeout: number): number;
  function clearInterval(handle: number): void;
} // declare global

export { }
