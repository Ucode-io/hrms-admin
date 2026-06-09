// Master switch for the Recruiting module data source.
//
// true  → the module runs entirely on the in-memory mock store (no API calls).
// false → services hit the real items API.
//
// Next stage: flip this to false once the backend collections are ready.
export const RECRUITING_USE_MOCK = true;
