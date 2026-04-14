export const getPhoneDigits = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('7') ? digits.slice(1) : digits;
};
