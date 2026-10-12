export function getSouthAfricanIdBirthDate(identityNumber: string): string | null {
  if (!/^\d{13}$/.test(identityNumber)) return null;

  const digits = identityNumber.split("").map(Number);
  if (digits[10] !== 0 && digits[10] !== 1) return null;

  let sum = digits[12];
  let doubleDigit = true;
  for (let index = 11; index >= 0; index -= 1) {
    const value = digits[index] * (doubleDigit ? 2 : 1);
    sum += value > 9 ? value - 9 : value;
    doubleDigit = !doubleDigit;
  }
  if (sum % 10 !== 0) return null;

  const today = new Date();
  let year = Math.floor(today.getFullYear() / 100) * 100 + Number(identityNumber.slice(0, 2));
  if (year > today.getFullYear()) year -= 100;

  const month = Number(identityNumber.slice(2, 4));
  const day = Number(identityNumber.slice(4, 6));
  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birthDate > todayAtMidnight) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
