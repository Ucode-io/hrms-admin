type Enrollment = { full_name?: string | null; hikvision_id?: string | null; mac_address?: string | null; picture?: string | null };
type Route = { mac_address?: string | null; companies_id?: string | null };
type RecordIdentity = { source?: string | null; hikvision_id?: string | null; companies_id?: string | null };
const normalized = (value?: string | null) => String(value || "").trim().toLowerCase();
export const isUnresolvedDeviceRecord = (item: RecordIdentity) => normalized(item.source) === "hikvision_unresolved_v1";

// Bound records use the verified employee relation and their own scan picture.
// Legacy records lack a source MAC: only a single device's enrollment is usable.
export function recordEnrollment<T extends Enrollment>(item: RecordIdentity, users: T[], routes: Route[]): T | undefined {
  if (isUnresolvedDeviceRecord(item) || normalized(item.source) === "hikvision_device_binding_v1") return undefined;
  const company = item.companies_id;
  const id = String(item.hikvision_id || "").trim();
  if (!company || !id) return undefined;
  const companyDevices = new Set(routes.filter(route => route.companies_id === company).map(route => normalized(route.mac_address)).filter(Boolean));
  // A missing enrollment row does not prove another terminal lacks this number.
  if (companyDevices.size !== 1) return undefined;
  const matches = users.filter(user => String(user.hikvision_id || "").trim() === id && routes.some(route => route.companies_id === company && normalized(route.mac_address) === normalized(user.mac_address) && normalized(user.mac_address)));
  const devices = new Set(matches.map(user => normalized(user.mac_address)));
  if (devices.size !== 1) return undefined;
  const names = new Set(matches.map(user => String(user.full_name || "").trim()).filter(Boolean));
  if (names.size > 1) return undefined;
  return matches[0];
}
