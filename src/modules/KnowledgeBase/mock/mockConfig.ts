// Master switch for the Knowledge Base data source.
//
// true  → the module runs entirely on the in-memory mock store (no API calls).
// false → real backend: items API for CRUD + `get_knowledge_base_articles`
//         reports method for the tree list (requires the function deployed).
export const KNOWLEDGE_USE_MOCK = false;
