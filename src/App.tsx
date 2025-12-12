// TypeScript-only fallback entry point.
//
// Metro will prefer platform files (`App.native.tsx`, `App.web.tsx`), but `tsc`
// needs a resolvable module for `import App from "./src/App"`.
export { default } from "./App.native";
