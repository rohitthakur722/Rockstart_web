const UNITS = ["B", "KB", "MB", "GB"];

export function formatFileSize(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value === 0) return "0 B";

  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < UNITS.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const formatted = Number.isInteger(size) ? String(size) : size.toFixed(1);
  return `${formatted} ${UNITS[unitIndex]}`;
}
