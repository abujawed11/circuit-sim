/**
 * Format electrical values with appropriate units and precision
 */

/**
 * Format voltage value with appropriate unit (V, mV, µV, kV)
 * @param {number} volts - Voltage in volts
 * @returns {string} Formatted string (e.g., "5.0V", "250mV", "12.5kV")
 */
export function formatVoltage(volts) {
  if (volts === null || volts === undefined || isNaN(volts)) return "N/A";

  const abs = Math.abs(volts);

  if (abs === 0) return "0V";
  if (abs >= 1000) return `${(volts / 1000).toFixed(2)}kV`;
  if (abs >= 1) return `${volts.toFixed(2)}V`;
  if (abs >= 0.001) return `${(volts * 1000).toFixed(1)}mV`;
  return `${(volts * 1000000).toFixed(0)}µV`;
}

/**
 * Format current value with appropriate unit (A, mA, µA, nA)
 * @param {number} amps - Current in amperes
 * @returns {string} Formatted string (e.g., "1.5A", "25mA", "150µA")
 */
export function formatCurrent(amps) {
  if (amps === null || amps === undefined || isNaN(amps)) return "N/A";

  const abs = Math.abs(amps);

  if (abs === 0) return "0A";
  if (abs >= 1) return `${amps.toFixed(2)}A`;
  if (abs >= 0.001) return `${(amps * 1000).toFixed(1)}mA`;
  if (abs >= 0.000001) return `${(amps * 1000000).toFixed(0)}µA`;
  return `${(amps * 1000000000).toFixed(0)}nA`;
}

/**
 * Format power value with appropriate unit (W, mW, µW, kW)
 * @param {number} watts - Power in watts
 * @returns {string} Formatted string (e.g., "2.5W", "150mW")
 */
export function formatPower(watts) {
  if (watts === null || watts === undefined || isNaN(watts)) return "N/A";

  const abs = Math.abs(watts);

  if (abs === 0) return "0W";
  if (abs >= 1000) return `${(watts / 1000).toFixed(2)}kW`;
  if (abs >= 1) return `${watts.toFixed(2)}W`;
  if (abs >= 0.001) return `${(watts * 1000).toFixed(1)}mW`;
  return `${(watts * 1000000).toFixed(0)}µW`;
}
