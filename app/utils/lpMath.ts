/**
 * Pure math helpers for Uniswap V3 / Aerodrome Slipstream LP position math.
 * Exported so they can be unit-tested independently of the React component.
 */

export function sqrtBigInt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("Square root of negative bigint");
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/**
 * Convert a human-readable price (sorted1 per sorted0) to sqrtPriceX96.
 *
 * pool_price  = humanPrice × 10^(token1Dec − token0Dec)
 * sqrtPriceX96 = sqrt(pool_price) × 2^96
 */
/**
 * Convert a human-readable price (sorted1 per sorted0) to sqrtPriceX96.
 *
 * pool_price  = humanPrice × 10^(token1Dec − token0Dec)
 * sqrtPriceX96 = floor(sqrt(pool_price) × 2^96)
 *
 * Represented as a rational num/den = pool_price, then:
 *   sqrtPriceX96 = floor(sqrt(num × Q96² / den))
 *
 * Note: no extra PRECISION factor — that would inflate the result by √(1e18) = 1e9.
 */
export function priceToSqrtPriceX96(
  humanPrice: number,
  token0Dec: number,
  token1Dec: number
): bigint {
  const Q96 = 2n ** 96n;
  const decAdj = token1Dec - token0Dec;
  // Encode humanPrice as an integer * 1e18 to avoid floating-point truncation
  const priceScaled = BigInt(Math.round(humanPrice * 1e18));
  // num/den = pool_price = humanPrice * 10^decAdj
  let num: bigint;
  let den: bigint;
  if (decAdj >= 0) {
    num = priceScaled * 10n ** BigInt(decAdj);
    den = 10n ** 18n;
  } else {
    num = priceScaled;
    den = 10n ** 18n * 10n ** BigInt(-decAdj);
  }
  // sqrtPriceX96 = floor(sqrt(num * Q96^2 / den))
  const insideSqrt = (num * Q96 * Q96) / den;
  return sqrtBigInt(insideSqrt);
}

/**
 * Convert a human-readable price (sorted1 per sorted0) to the nearest Uniswap V3 tick.
 */
export function priceToTick(
  humanPrice: number,
  token0Dec: number,
  token1Dec: number
): number {
  const poolPrice = humanPrice * Math.pow(10, token1Dec - token0Dec);
  if (poolPrice <= 0) return 0;
  return Math.floor(Math.log(poolPrice) / Math.log(1.0001));
}

/**
 * Snap a raw tick to the nearest valid tick for a given spacing.
 * isLower=true  → snap down (floor to grid) so tickLower ≤ desired price
 * isLower=false → snap up  (ceil to grid) so tickUpper ≥ desired price
 */
export function snapTick(tick: number, spacing: number, isLower: boolean): number {
  const rounded = Math.round(tick / spacing) * spacing;
  if (isLower) {
    return tick < rounded ? rounded - spacing : rounded;
  } else {
    return tick > rounded ? rounded + spacing : rounded;
  }
}

/**
 * Sort two tokens by address (ascending), as required by Uniswap V3 / Aerodrome.
 * Returns { sorted0, sorted1, wasSwapped }.
 */
export function sortTokens<T extends { address: string }>(
  t0: T,
  t1: T
): { sorted0: T; sorted1: T; wasSwapped: boolean } {
  const swapped = t0.address.toLowerCase() > t1.address.toLowerCase();
  return {
    sorted0: swapped ? t1 : t0,
    sorted1: swapped ? t0 : t1,
    wasSwapped: swapped,
  };
}
