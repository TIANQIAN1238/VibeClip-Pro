/* eslint-disable */
// @ts-nocheck
/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const component: DefineComponent<{}, {}, any>;
  export default component;
}
