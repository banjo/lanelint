const format = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const PriceUtil = {
  format,
};
