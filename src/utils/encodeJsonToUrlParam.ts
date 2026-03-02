function encodeJsonToUrlParam(json: any) {
  if (!json) return "{}";
  return encodeURIComponent(JSON.stringify(json));
}

export default encodeJsonToUrlParam;