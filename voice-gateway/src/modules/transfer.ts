/**
 * Select transfer target — model never passes arbitrary numbers (TZ §30.8).
 */
import { loadTelephonyRuntime } from "./telephony-runtime.js";

export type TransferTarget = {
  label: string;
  e164: string;
};

export async function selectTransferTarget(
  reason: string,
): Promise<TransferTarget | null> {
  const runtime = await loadTelephonyRuntime();
  if (reason === "emergency_water" && runtime.transferEmergencyE164) {
    return { label: "Notfall", e164: runtime.transferEmergencyE164 };
  }
  if (runtime.transferOfficeE164) {
    return {
      label: reason === "emergency_water" ? "Notfall/Büro" : "Büro",
      e164: runtime.transferOfficeE164,
    };
  }
  console.warn("[transfer] no transfer number configured", reason);
  return null;
}
