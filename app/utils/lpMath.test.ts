/**
 * Unit tests for LP math helpers — covers both Uniswap V3 and Aerodrome Slipstream.
 *
 * Aerodrome Slipstream is identical to Uniswap V3 for tick/price math.
 * The differences are:
 *   - tickSpacing 200 (not fee-derived) — ticks must be multiples of 200
 *   - mint() takes sqrtPriceX96 directly (pool init + mint in one call)
 *   - No createAndInitializePoolIfNecessary step
 *
 * Token pair used throughout: HLRR (token0, 8 dec) / USDC (token1, 6 dec)
 * Addresses (Base mainnet):
 *   HLRR  0x5E1583d48bcFd60de77138ea195f3EFbe128405d  (< USDC by address)
 *   USDC  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */

import { describe, it, expect } from "vitest";
import { priceToSqrtPriceX96, priceToTick, snapTick, sortTokens } from "./lpMath";

// ─── Constants ────────────────────────────────────────────────────────────────

const HLRR = {
  address: "0x5E1583d48bcFd60de77138ea195f3EFbe128405d",
  symbol: "HLRR",
  decimals: 8,
};
const USDC = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  symbol: "USDC",
  decimals: 6,
};
const WETH = {
  address: "0x4200000000000000000000000000000000000006",
  symbol: "WETH",
  decimals: 18,
};

// Aerodrome Slipstream tick spacing for HLRR/USDC pair
const AERO_TICK_SPACING = 200;
// Uniswap V3 fee=3000 tick spacing
const UNI_TICK_SPACING_3000 = 60;

// ─── sortTokens ───────────────────────────────────────────────────────────────

describe("sortTokens", () => {
  it("HLRR(0x5E) < USDC(0x83) — HLRR becomes sorted0, no swap", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(HLRR, USDC);
    expect(sorted0.symbol).toBe("HLRR");
    expect(sorted1.symbol).toBe("USDC");
    expect(wasSwapped).toBe(false);
  });

  it("selecting USDC as t0 and HLRR as t1 detects swap", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(USDC, HLRR);
    expect(sorted0.symbol).toBe("HLRR");
    expect(sorted1.symbol).toBe("USDC");
    expect(wasSwapped).toBe(true);
  });

  it("WETH(0x42) < USDC(0x83) — WETH becomes sorted0", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WETH, USDC);
    expect(sorted0.symbol).toBe("WETH");
    expect(sorted1.symbol).toBe("USDC");
    expect(wasSwapped).toBe(false);
  });
});

// ─── priceToTick ─────────────────────────────────────────────────────────────

describe("priceToTick — HLRR(8)/USDC(6) decimal adjustment", () => {
  /**
   * Regression guard: with HLRR(8 dec) as token0 and USDC(6 dec) as token1,
   * pool_price = humanPrice × 10^(6−8) = humanPrice / 100.
   * The tick must reflect this 100× adjustment.
   * Without adjustment (treating both as same decimals) the tick would be ~100×
   * closer to zero — the bug that caused the $5000 USDC to go into wrong range.
   */
  it("$0.075/HLRR yields tick near −72000 (not −25000)", () => {
    const tick = priceToTick(0.075, HLRR.decimals, USDC.decimals);
    // pool_price = 0.075 × 10^(6−8) = 0.00075
    // tick = floor(ln(0.00075) / ln(1.0001)) ≈ −71954
    expect(tick).toBeCloseTo(-71954, -2); // within ±100
    expect(tick).toBeLessThan(-60000);    // definitively NOT the buggy ~−25000 range
  });

  it("$0.06/HLRR (min) yields tick near −74194", () => {
    const tick = priceToTick(0.06, HLRR.decimals, USDC.decimals);
    expect(tick).toBeCloseTo(-74194, -2);
  });

  it("$0.15/HLRR (max) yields tick near −65013", () => {
    const tick = priceToTick(0.15, HLRR.decimals, USDC.decimals);
    expect(tick).toBeCloseTo(-65013, -2);
  });

  it("min tick < starting tick < max tick (price range is valid)", () => {
    const tickMin = priceToTick(0.06, HLRR.decimals, USDC.decimals);
    const tickStart = priceToTick(0.075, HLRR.decimals, USDC.decimals);
    const tickMax = priceToTick(0.15, HLRR.decimals, USDC.decimals);
    expect(tickMin).toBeLessThan(tickStart);
    expect(tickStart).toBeLessThan(tickMax);
  });
});

// ─── snapTick ────────────────────────────────────────────────────────────────

describe("snapTick — Aerodrome tick spacing 200", () => {
  it("snapped tickLower is a multiple of 200", () => {
    const raw = priceToTick(0.06, HLRR.decimals, USDC.decimals); // ≈ −74194
    const snapped = snapTick(raw, AERO_TICK_SPACING, true);
    expect(snapped % AERO_TICK_SPACING).toBe(-0);  // JS % on negatives gives -0; check with ==
    expect(snapped % AERO_TICK_SPACING == 0).toBe(true);
  });

  it("snapped tickUpper is a multiple of 200", () => {
    const raw = priceToTick(0.15, HLRR.decimals, USDC.decimals); // ≈ −65013
    const snapped = snapTick(raw, AERO_TICK_SPACING, false);
    expect(snapped % AERO_TICK_SPACING == 0).toBe(true);
  });

  it("tickLower (isLower=true) snaps down — snapped ≤ raw tick", () => {
    const raw = priceToTick(0.06, HLRR.decimals, USDC.decimals);
    const snapped = snapTick(raw, AERO_TICK_SPACING, true);
    expect(snapped).toBeLessThanOrEqual(raw);
  });

  it("tickUpper (isLower=false) snaps up — snapped ≥ raw tick", () => {
    const raw = priceToTick(0.15, HLRR.decimals, USDC.decimals);
    const snapped = snapTick(raw, AERO_TICK_SPACING, false);
    expect(snapped).toBeGreaterThanOrEqual(raw);
  });

  it("tickLower < tickUpper after snapping", () => {
    const lower = snapTick(priceToTick(0.06, HLRR.decimals, USDC.decimals), AERO_TICK_SPACING, true);
    const upper = snapTick(priceToTick(0.15, HLRR.decimals, USDC.decimals), AERO_TICK_SPACING, false);
    expect(lower).toBeLessThan(upper);
  });

  it("already-aligned tick is unchanged", () => {
    expect(snapTick(-72000, AERO_TICK_SPACING, true)).toBe(-72000);
    expect(snapTick(-72000, AERO_TICK_SPACING, false)).toBe(-72000);
  });

  it("Uniswap fee=3000 tick spacing 60 also aligns correctly", () => {
    const raw = priceToTick(0.06, HLRR.decimals, USDC.decimals);
    const snapped = snapTick(raw, UNI_TICK_SPACING_3000, true);
    expect(snapped % UNI_TICK_SPACING_3000 == 0).toBe(true);
  });
});

// ─── priceToSqrtPriceX96 ─────────────────────────────────────────────────────

describe("priceToSqrtPriceX96 — HLRR(8)/USDC(6)", () => {
  /**
   * sqrtPriceX96 = sqrt(pool_price) × 2^96
   * pool_price = 0.00075 (for $0.075/HLRR)
   * sqrt(0.00075) ≈ 0.027386
   * sqrtPriceX96 ≈ 0.027386 × 2^96 ≈ 2.170e27
   */
  it("$0.075/HLRR produces a positive sqrtPriceX96", () => {
    const sqrtP = priceToSqrtPriceX96(0.075, HLRR.decimals, USDC.decimals);
    expect(sqrtP).toBeGreaterThan(0n);
  });

  it("sqrtPriceX96 for $0.075 is in expected range (≈2.17e27)", () => {
    const sqrtP = priceToSqrtPriceX96(0.075, HLRR.decimals, USDC.decimals);
    // pool_price = 0.075 × 10^(6−8) = 0.00075
    // sqrt(0.00075) ≈ 0.027386
    // 2^96 ≈ 7.9228e28
    // sqrtPriceX96 ≈ 0.027386 × 7.9228e28 ≈ 2.170e27
    const expected = 2170000000000000000000000000n; // 2.17e27
    const tolerance = 50000000000000000000000000n;   // ±5e25 (~2%)
    expect(sqrtP).toBeGreaterThan(expected - tolerance);
    expect(sqrtP).toBeLessThan(expected + tolerance);
  });

  it("higher price gives higher sqrtPriceX96", () => {
    const sqrtLow  = priceToSqrtPriceX96(0.06,  HLRR.decimals, USDC.decimals);
    const sqrtMid  = priceToSqrtPriceX96(0.075, HLRR.decimals, USDC.decimals);
    const sqrtHigh = priceToSqrtPriceX96(0.15,  HLRR.decimals, USDC.decimals);
    expect(sqrtLow).toBeLessThan(sqrtMid);
    expect(sqrtMid).toBeLessThan(sqrtHigh);
  });

  it("starting price tick is within [tickLower, tickUpper] range", () => {
    const tickStart = priceToTick(0.075, HLRR.decimals, USDC.decimals);
    const tickLower = snapTick(priceToTick(0.06,  HLRR.decimals, USDC.decimals), AERO_TICK_SPACING, true);
    const tickUpper = snapTick(priceToTick(0.15,  HLRR.decimals, USDC.decimals), AERO_TICK_SPACING, false);
    expect(tickStart).toBeGreaterThan(tickLower);
    expect(tickStart).toBeLessThan(tickUpper);
  });
});

// ─── wasSwapped amount routing ────────────────────────────────────────────────

describe("wasSwapped — amount routing to sorted slots", () => {
  /**
   * Regardless of which token the user puts in the t0/t1 dropdowns,
   * the amount for HLRR must be passed as amt0Raw (sorted0=HLRR)
   * and the amount for USDC must be passed as amt1Raw (sorted1=USDC).
   */
  function routeAmounts(
    t0: typeof HLRR,
    t1: typeof USDC,
    amount0: string, // user-entered amount for t0
    amount1: string  // user-entered amount for t1
  ) {
    const { wasSwapped } = sortTokens(t0, t1);
    return {
      amtForSorted0: wasSwapped ? amount1 : amount0, // goes to sorted0 (HLRR)
      amtForSorted1: wasSwapped ? amount0 : amount1, // goes to sorted1 (USDC)
    };
  }

  it("natural order (t0=HLRR, t1=USDC): HLRR amount → sorted0, USDC → sorted1", () => {
    const { amtForSorted0, amtForSorted1 } = routeAmounts(HLRR, USDC, "150000", "5000");
    expect(amtForSorted0).toBe("150000"); // HLRR
    expect(amtForSorted1).toBe("5000");   // USDC
  });

  it("reversed order (t0=USDC, t1=HLRR): amounts correctly cross-routed", () => {
    // user put USDC as t0 (amount0=5000) and HLRR as t1 (amount1=150000)
    const { amtForSorted0, amtForSorted1 } = routeAmounts(USDC as any, HLRR as any, "5000", "150000");
    expect(amtForSorted0).toBe("150000"); // HLRR still goes to sorted0
    expect(amtForSorted1).toBe("5000");   // USDC still goes to sorted1
  });
});

// ─── Price label convention ───────────────────────────────────────────────────

describe("price label always shows sorted1/sorted0 regardless of dropdown order", () => {
  function getPriceLabel(t0: { symbol: string; address: string }, t1: { symbol: string; address: string }) {
    const { sorted0, sorted1 } = sortTokens(t0, t1);
    return `${sorted1.symbol}/${sorted0.symbol}`;
  }

  it("t0=HLRR, t1=USDC → label is USDC/HLRR", () => {
    expect(getPriceLabel(HLRR, USDC)).toBe("USDC/HLRR");
  });

  it("t0=USDC, t1=HLRR → label is still USDC/HLRR (not HLRR/USDC)", () => {
    expect(getPriceLabel(USDC as any, HLRR as any)).toBe("USDC/HLRR");
  });
});

// ─── Aerodrome-specific: tick spacing 200 full flow ──────────────────────────

describe("Aerodrome Slipstream full LP parameter flow — HLRR/USDC", () => {
  const startPrice = 0.075;
  const minPrice   = 0.04;
  const maxPrice   = 0.25;

  it("produces valid Aerodrome mint params from natural HLRR/USDC pair", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(HLRR, USDC);
    expect(wasSwapped).toBe(false);

    const sqrtPriceX96 = priceToSqrtPriceX96(startPrice, sorted0.decimals, sorted1.decimals);
    const rawLower = priceToTick(minPrice, sorted0.decimals, sorted1.decimals);
    const rawUpper = priceToTick(maxPrice, sorted0.decimals, sorted1.decimals);
    const tickLower = snapTick(rawLower, AERO_TICK_SPACING, true);
    const tickUpper = snapTick(rawUpper, AERO_TICK_SPACING, false);

    expect(sqrtPriceX96).toBeGreaterThan(0n);
    expect(tickLower % AERO_TICK_SPACING == 0).toBe(true);
    expect(tickUpper % AERO_TICK_SPACING == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);

    // Starting tick should fall within range
    const startTick = priceToTick(startPrice, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);

    // Ticks should be in the −80000 to −60000 range for $0.04–$0.25/HLRR
    expect(tickLower).toBeLessThan(-70000);
    expect(tickUpper).toBeGreaterThan(-70000);
  });

  it("produces identical ticks whether user puts HLRR or USDC in the t0 slot", () => {
    // Natural order
    const { sorted0: s0a, sorted1: s1a } = sortTokens(HLRR, USDC);
    const lowerA = snapTick(priceToTick(minPrice, s0a.decimals, s1a.decimals), AERO_TICK_SPACING, true);
    const upperA = snapTick(priceToTick(maxPrice, s0a.decimals, s1a.decimals), AERO_TICK_SPACING, false);
    const sqrtA  = priceToSqrtPriceX96(startPrice, s0a.decimals, s1a.decimals);

    // Reversed order in dropdowns
    const { sorted0: s0b, sorted1: s1b } = sortTokens(USDC as any, HLRR as any);
    const lowerB = snapTick(priceToTick(minPrice, s0b.decimals, s1b.decimals), AERO_TICK_SPACING, true);
    const upperB = snapTick(priceToTick(maxPrice, s0b.decimals, s1b.decimals), AERO_TICK_SPACING, false);
    const sqrtB  = priceToSqrtPriceX96(startPrice, s0b.decimals, s1b.decimals);

    expect(lowerA).toBe(lowerB);
    expect(upperA).toBe(upperB);
    expect(sqrtA).toBe(sqrtB);
  });

  it("regression: starting price $0.075 always gives sqrtPriceX96 reflecting $0.075 (not $7.5)", () => {
    const { sorted0, sorted1 } = sortTokens(HLRR, USDC);
    const sqrtP = priceToSqrtPriceX96(0.075, sorted0.decimals, sorted1.decimals);

    // Reconstruct pool_price from sqrtPriceX96:
    //   pool_price = (sqrtPriceX96 / 2^96)^2
    // Use a scaled integer to avoid bigint precision loss:
    //   pool_price × 1e18 = sqrtP^2 × 1e18 / Q96^2
    const Q96 = 2n ** 96n;
    const SCALE = 10n ** 18n;
    const poolPriceScaled = (sqrtP * sqrtP * SCALE) / (Q96 * Q96);
    // human_price (USDC/HLRR) = pool_price × 10^(token0Dec − token1Dec)
    //                          = pool_price × 10^(8−6) = pool_price × 100
    // human_price × 1e18 = poolPriceScaled × 100
    const humanPriceScaled = poolPriceScaled * 100n;

    // Expected: 0.075 × 1e18 = 75_000_000_000_000_000
    const expected = 75_000_000_000_000_000n;
    const tolerance =  2_000_000_000_000_000n; // ±~2.7%
    expect(humanPriceScaled).toBeGreaterThan(expected - tolerance);
    expect(humanPriceScaled).toBeLessThan(expected + tolerance);
  });
});
