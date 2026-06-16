// Master switch for the Recruiting module data source.
//
// true  → the module runs entirely on the in-memory mock store (no API calls).
// false → services hit the real items API + udevs-hrms-reports functions.
//
// Backend collections + udevs-hrms-reports recruiting_* methods are live.
export const RECRUITING_USE_MOCK = false;
