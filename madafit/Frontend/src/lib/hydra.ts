export function extractHydraMembers<T>(response: any): T[] {
  if (!response) return [];
  if (response["hydra:member"] && Array.isArray(response["hydra:member"])) {
    return response["hydra:member"];
  }
  if (Array.isArray(response)) return response;
  return [];
}