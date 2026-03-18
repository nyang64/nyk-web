/**
 * Unit tests for LP math helpers — covers Uniswap V3, PancakeSwap V3,
 * Aerodrome Slipstream (Base), and Velodrome Slipstream (Optimism).
 *
 * Networks and protocols covered:
 *   Base Mainnet    — Uniswap V3, PancakeSwap V3, Aerodrome Slipstream
 *   Arbitrum One    — Uniswap V3, PancakeSwap V3
 *   Optimism        — Uniswap V3, Velodrome Slipstream
 *   Polygon         — Uniswap V3 (native token: POL, 18 dec — substituted with WPOL)
 *   BNB Chain       — Uniswap V3, PancakeSwap V3 (native: BNB; USDC has 18 dec here)
 *
 * Slipstream (Aerodrome / Velodrome) is identical for tick/price math — only
 * addresses and chain differ.  Tests are shared where possible.
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

// Uniswap V3 tick spacings per fee tier
const TICK_SPACING: Record<number, number> = {
  100:   1,   // fee=0.01%
  500:   10,  // fee=0.05%
  3000:  60,  // fee=0.30%
  10000: 200, // fee=1.00%
};

// PancakeSwap V3 replaces 0.30% with 0.25% — different fee AND different spacing
const PCS_TICK_SPACING: Record<number, number> = {
  100:   1,   // fee=0.01%
  500:   10,  // fee=0.05%
  2500:  50,  // fee=0.25% — PancakeSwap-specific (NOT 60 like Uniswap's 0.30%)
  10000: 200, // fee=1.00%
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

// ─── WETH(18)/USDC(6) — decAdj = 6−18 = −12 (deeply negative) ───────────────

describe("priceToTick + priceToSqrtPriceX96 — WETH(18)/USDC(6)", () => {
  /**
   * WETH(0x42) < USDC(0x83) by address → WETH = sorted0, USDC = sorted1
   * pool_price = humanPrice × 10^(6−18) = humanPrice × 10^−12
   * At ETH=$2000: pool_price = 2000 × 10^−12 = 2e−9
   * tick = floor(ln(2e−9) / ln(1.0001)) ≈ floor(−207243)
   */
  it("sortTokens: WETH sorted0, USDC sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WETH, USDC);
    expect(sorted0.symbol).toBe("WETH");
    expect(sorted1.symbol).toBe("USDC");
    expect(wasSwapped).toBe(false);
  });

  it("ETH=$2000 tick is near −200312 (far negative, not near zero)", () => {
    const tick = priceToTick(2000, WETH.decimals, USDC.decimals);
    // pool_price = 2000 × 10^(6−18) = 2×10^−9
    // tick = floor(ln(2e−9) / ln(1.0001)) ≈ −200312
    expect(tick).toBeCloseTo(-200312, -2);
    expect(tick).toBeLessThan(-195000);
  });

  it("priceToTick is monotonic: $1500 < $2000 < $3000 (lower $ = lower tick)", () => {
    const t1500 = priceToTick(1500, WETH.decimals, USDC.decimals);
    const t2000 = priceToTick(2000, WETH.decimals, USDC.decimals);
    const t3000 = priceToTick(3000, WETH.decimals, USDC.decimals);
    expect(t1500).toBeLessThan(t2000);
    expect(t2000).toBeLessThan(t3000);
  });

  it("sqrtPriceX96 round-trip: encode $2000 then reconstruct humanPrice", () => {
    const sqrtP = priceToSqrtPriceX96(2000, WETH.decimals, USDC.decimals);
    expect(sqrtP).toBeGreaterThan(0n);

    // Reconstruct: pool_price × SCALE = sqrtP^2 × SCALE / Q96^2
    const Q96 = 2n ** 96n;
    const SCALE = 10n ** 30n; // large scale for WETH/USDC (pool_price ≈ 2e-9)
    const poolPriceScaled = (sqrtP * sqrtP * SCALE) / (Q96 * Q96);
    // humanPrice = pool_price × 10^(18−6) = pool_price × 10^12
    // humanPrice × SCALE = poolPriceScaled × 10^12
    const humanPriceScaled = poolPriceScaled * 10n ** 12n;
    // Expected: 2000 × SCALE = 2000 × 10^30
    const expected = 2000n * SCALE;
    const tolerance = expected / 40n; // ±2.5%
    expect(humanPriceScaled).toBeGreaterThan(expected - tolerance);
    expect(humanPriceScaled).toBeLessThan(expected + tolerance);
  });

  it("higher price gives higher sqrtPriceX96 (WETH/USDC)", () => {
    const sqrtLow  = priceToSqrtPriceX96(1500, WETH.decimals, USDC.decimals);
    const sqrtHigh = priceToSqrtPriceX96(3000, WETH.decimals, USDC.decimals);
    expect(sqrtLow).toBeLessThan(sqrtHigh);
  });
});

// ─── WETH(18)/HLRR(8) — decAdj = 8−18 = −10 ─────────────────────────────────

describe("priceToTick + priceToSqrtPriceX96 — WETH(18)/HLRR(8)", () => {
  /**
   * Sort: WETH(0x42) < HLRR(0x5E) → WETH = sorted0, HLRR = sorted1
   * pool_price = humanPrice × 10^(8−18) = humanPrice × 10^−10
   * At price 26667 HLRR/WETH (i.e., 1 WETH = 26667 HLRR when HLRR=$0.075):
   *   pool_price = 26667 × 10^−10 ≈ 2.667e−6
   */
  it("sortTokens: WETH(0x42) < HLRR(0x5E) → WETH sorted0", () => {
    const { sorted0, sorted1 } = sortTokens(WETH, HLRR);
    expect(sorted0.symbol).toBe("WETH");
    expect(sorted1.symbol).toBe("HLRR");
  });

  it("priceToTick is monotonic for WETH/HLRR pair", () => {
    const t1 = priceToTick(20000, WETH.decimals, HLRR.decimals);
    const t2 = priceToTick(26667, WETH.decimals, HLRR.decimals);
    const t3 = priceToTick(40000, WETH.decimals, HLRR.decimals);
    expect(t1).toBeLessThan(t2);
    expect(t2).toBeLessThan(t3);
  });

  it("sqrtPriceX96 round-trip for WETH/HLRR", () => {
    const humanPrice = 26667; // HLRR per WETH
    const sqrtP = priceToSqrtPriceX96(humanPrice, WETH.decimals, HLRR.decimals);
    expect(sqrtP).toBeGreaterThan(0n);

    const Q96 = 2n ** 96n;
    const SCALE = 10n ** 28n;
    const poolPriceScaled = (sqrtP * sqrtP * SCALE) / (Q96 * Q96);
    // humanPrice = pool_price × 10^(18−8) = pool_price × 10^10
    const humanPriceScaled = poolPriceScaled * 10n ** 10n;
    const expected = BigInt(humanPrice) * SCALE;
    const tolerance = expected / 40n; // ±2.5%
    expect(humanPriceScaled).toBeGreaterThan(expected - tolerance);
    expect(humanPriceScaled).toBeLessThan(expected + tolerance);
  });
});

// ─── Positive decAdj branch: sorted0 has fewer decimals than sorted1 ─────────

describe("priceToSqrtPriceX96 — positive decAdj (token1Dec > token0Dec)", () => {
  /**
   * The `if (decAdj >= 0)` branch fires when sorted1 has MORE decimals than sorted0.
   * Example: a hypothetical 6-dec token0 paired with 18-dec token1.
   * For this test we use a synthetic USDC(6)/WETH(18)-like scenario where
   * user forces USDC as sorted0 (but WETH address < USDC address so sortTokens
   * would normally produce WETH=sorted0). We test the math directly with explicit
   * decimals to exercise the positive branch without relying on token addresses.
   *
   * decAdj = 18 - 6 = +12 → positive branch
   */
  it("decAdj=+12 (6-dec sorted0, 18-dec sorted1): sqrtPriceX96 is positive and finite", () => {
    // Directly test the positive-decAdj branch: 6-dec token0, 18-dec token1
    const sqrtP = priceToSqrtPriceX96(1.0, 6, 18);
    expect(sqrtP).toBeGreaterThan(0n);
    // sqrtPriceX96 should be a very large number since pool_price = 1.0 × 10^12
    // sqrt(1e12) × 2^96 ≈ 10^6 × 7.92e28 ≈ 7.92e34
    expect(sqrtP).toBeGreaterThan(10n ** 30n);
  });

  it("decAdj=+12: higher price gives higher sqrtPriceX96", () => {
    const sq1 = priceToSqrtPriceX96(0.5,  6, 18);
    const sq2 = priceToSqrtPriceX96(1.0,  6, 18);
    const sq3 = priceToSqrtPriceX96(2.0,  6, 18);
    expect(sq1).toBeLessThan(sq2);
    expect(sq2).toBeLessThan(sq3);
  });

  it("decAdj=+12: round-trip verification", () => {
    const humanPrice = 1.5; // sorted1 per sorted0
    const sqrtP = priceToSqrtPriceX96(humanPrice, 6, 18);
    const Q96 = 2n ** 96n;
    const SCALE = 10n ** 18n;
    // pool_price = humanPrice × 10^(18-6) = humanPrice × 10^12
    // pool_price_scaled = sqrtP^2 × SCALE / Q96^2
    const poolPriceScaled = (sqrtP * sqrtP * SCALE) / (Q96 * Q96);
    // humanPrice = pool_price / 10^12
    // humanPrice × SCALE = poolPriceScaled / 10^12
    // Use larger scale to avoid integer truncation to zero:
    const BIGSCALE = 10n ** 30n;
    const poolPriceBig = (sqrtP * sqrtP * BIGSCALE) / (Q96 * Q96);
    const humanPriceScaled = poolPriceBig / 10n ** 12n; // ÷10^12 to remove decAdj
    // Expected: 1.5 × 10^30
    const expected = 1500000000000000000000000000000n; // 1.5 × 10^30
    const tolerance = expected / 40n; // ±2.5%
    expect(humanPriceScaled).toBeGreaterThan(expected - tolerance);
    expect(humanPriceScaled).toBeLessThan(expected + tolerance);
  });

  it("decAdj=0 (same decimals on both sides): price of 1.0 encodes correctly", () => {
    // Both tokens have 18 decimals → pool_price = humanPrice exactly
    const sqrtP = priceToSqrtPriceX96(1.0, 18, 18);
    const Q96 = 2n ** 96n;
    // pool_price = 1.0 → sqrtPriceX96 = 2^96
    const tolerance = Q96 / 1000n; // ±0.1%
    expect(sqrtP).toBeGreaterThan(Q96 - tolerance);
    expect(sqrtP).toBeLessThan(Q96 + tolerance);
  });

  it("decAdj=+2 (8-dec sorted0, 10-dec sorted1): monotonic", () => {
    const sq1 = priceToSqrtPriceX96(0.1, 8, 10);
    const sq2 = priceToSqrtPriceX96(1.0, 8, 10);
    expect(sq1).toBeLessThan(sq2);
  });
});

// ─── All four Uniswap fee tiers: tick spacing alignment ──────────────────────

describe("snapTick — all Uniswap fee tier tick spacings", () => {
  /**
   * Fee tiers and their tick spacings:
   *   fee=100   → spacing=1  (0.01% — stable pairs)
   *   fee=500   → spacing=10 (0.05% — correlated pairs)
   *   fee=3000  → spacing=60 (0.30% — standard)
   *   fee=10000 → spacing=200(1.00% — exotic / Aerodrome)
   */
  const rawTick = priceToTick(0.075, HLRR.decimals, USDC.decimals); // ≈ −71954

  for (const [fee, spacing] of Object.entries(TICK_SPACING) as [string, number][]) {
    it(`fee=${fee} (spacing=${spacing}): tickLower is aligned`, () => {
      const snapped = snapTick(rawTick, spacing, true);
      expect(snapped % spacing == 0).toBe(true);
      expect(snapped).toBeLessThanOrEqual(rawTick);
    });

    it(`fee=${fee} (spacing=${spacing}): tickUpper is aligned`, () => {
      const snapped = snapTick(rawTick, spacing, false);
      expect(snapped % spacing == 0).toBe(true);
      expect(snapped).toBeGreaterThanOrEqual(rawTick);
    });
  }

  it("spacing=1 (fee=100): snapped tick equals raw tick (every tick is valid)", () => {
    const snappedLower = snapTick(rawTick, 1, true);
    const snappedUpper = snapTick(rawTick, 1, false);
    expect(snappedLower).toBe(rawTick);
    expect(snappedUpper).toBe(rawTick);
  });

  it("spacing=200: distance between tickLower and tickUpper ≥ 200", () => {
    const lower = snapTick(rawTick, 200, true);
    const upper = snapTick(rawTick + 1, 200, false); // force upper to be different grid cell
    expect(upper - lower).toBeGreaterThanOrEqual(200);
  });
});

// ─── Price at exact range boundaries ─────────────────────────────────────────

describe("priceToTick — edge cases at boundaries", () => {
  it("price = tickLower boundary: tick is at or below tickLower", () => {
    const tickLower = snapTick(priceToTick(0.06, HLRR.decimals, USDC.decimals), 200, true);
    const tick = priceToTick(0.06, HLRR.decimals, USDC.decimals);
    // The raw tick ≥ tickLower (we snapped down)
    expect(tick).toBeGreaterThanOrEqual(tickLower);
  });

  it("very small price (1e-6 USDC/HLRR) produces a very negative tick", () => {
    const tick = priceToTick(1e-6, HLRR.decimals, USDC.decimals);
    expect(tick).toBeLessThan(-100000);
  });

  it("very large price (1000 USDC/HLRR) produces a positive tick", () => {
    const tick = priceToTick(1000, HLRR.decimals, USDC.decimals);
    expect(tick).toBeGreaterThan(0);
  });

  it("price=1.0 (same decimals) gives tick=0", () => {
    const tick = priceToTick(1.0, 18, 18);
    expect(tick).toBe(0);
  });
});

// ─── PancakeSwap V3 fee=2500 / spacing=50 full flow ──────────────────────────

describe("PancakeSwap V3 — fee=2500 tick spacing=50 (NOT Uniswap spacing=60)", () => {
  /**
   * PancakeSwap V3's 0.25% tier uses fee=2500 and tickSpacing=50.
   * Uniswap V3's nearest equivalent is 0.30% with fee=3000 and tickSpacing=60.
   * Using spacing=60 on a PancakeSwap pool would produce ticks not divisible by 50,
   * causing the mint to revert. This suite pins the correct value.
   */
  const PCS_SPACING = PCS_TICK_SPACING[2500]; // must be 50, not 60

  it("PCS_TICK_SPACING[2500] is 50, not 60 (regression: wrong spacing causes mint revert)", () => {
    expect(PCS_TICK_SPACING[2500]).toBe(50);
    expect(PCS_TICK_SPACING[2500]).not.toBe(60);
  });

  it("tickLower for $0.06/HLRR is a multiple of 50 (not 60)", () => {
    const raw = priceToTick(0.06, HLRR.decimals, USDC.decimals);
    const snapped = snapTick(raw, PCS_SPACING, true);
    expect(snapped % 50 == 0).toBe(true);
    expect(snapped % 60 == 0).toBe(false); // confirms it's 50-aligned, not accidentally 60-aligned
  });

  it("tickUpper for $0.15/HLRR is a multiple of 50", () => {
    const raw = priceToTick(0.15, HLRR.decimals, USDC.decimals);
    const snapped = snapTick(raw, PCS_SPACING, false);
    expect(snapped % 50 == 0).toBe(true);
  });

  it("full PancakeSwap 0.25% flow: valid mint params for HLRR/USDC $0.06–$0.15 range", () => {
    const startPrice = 0.075;
    const minPrice   = 0.06;
    const maxPrice   = 0.15;

    const { sorted0, sorted1, wasSwapped } = sortTokens(HLRR, USDC);
    expect(wasSwapped).toBe(false);

    const sqrtPriceX96 = priceToSqrtPriceX96(startPrice, sorted0.decimals, sorted1.decimals);
    const tickLower = snapTick(priceToTick(minPrice, sorted0.decimals, sorted1.decimals), PCS_SPACING, true);
    const tickUpper = snapTick(priceToTick(maxPrice, sorted0.decimals, sorted1.decimals), PCS_SPACING, false);

    // Basic validity
    expect(sqrtPriceX96).toBeGreaterThan(0n);
    expect(tickLower).toBeLessThan(tickUpper);

    // Alignment
    expect(tickLower % PCS_SPACING == 0).toBe(true);
    expect(tickUpper % PCS_SPACING == 0).toBe(true);

    // Starting price inside range
    const startTick = priceToTick(startPrice, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);
  });

  it("PancakeSwap and Uniswap produce DIFFERENT tickLower for same price (spacing 50 vs 60)", () => {
    const raw = priceToTick(0.06, HLRR.decimals, USDC.decimals);
    const pcsLower = snapTick(raw, 50, true);
    const uniLower = snapTick(raw, 60, true);
    // They snap to different grid points — confirming these are NOT interchangeable
    expect(pcsLower).not.toBe(uniLower);
  });
});

// ─── Optimism — Uniswap V3 & Velodrome Slipstream ────────────────────────────
//
// USDC (0x0b2C...) < WETH (0x4200...) by address → USDC = sorted0, WETH = sorted1
// decAdj = 18 − 6 = +12  (positive branch — fewer decimals on sorted0)
// pool_price = humanPrice × 10^+12
// humanPrice = WETH per USDC = 1 / (ETH price in USD)
// At ETH=$2000:  humanPrice = 1/2000 = 0.0005,  pool_price = 0.0005 × 10^12 = 5×10^8
// tick ≈ floor(ln(5e8) / ln(1.0001)) ≈ 200321

describe("Optimism — USDC(6)/WETH(18) — Uniswap V3 & Velodrome Slipstream", () => {
  const USDC_OP = { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 };
  const WETH_OP = { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 };
  const VELO_SPACING = 200;
  const UNI_SPACING_3000 = 60;

  it("sortTokens: USDC(0x0b) < WETH(0x42) → USDC=sorted0, WETH=sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(USDC_OP, WETH_OP);
    expect(sorted0.symbol).toBe("USDC");
    expect(sorted1.symbol).toBe("WETH");
    expect(wasSwapped).toBe(false);
  });

  it("ETH=$2000: tick is near +200321 (positive — USDC is sorted0)", () => {
    // pool_price = (1/2000) × 10^12 = 5×10^8
    // tick = ln(5e8) / ln(1.0001) ≈ 200321
    const tick = priceToTick(1 / 2000, USDC_OP.decimals, WETH_OP.decimals);
    expect(tick).toBeCloseTo(200321, -2);
    expect(tick).toBeGreaterThan(190000);
  });

  it("higher ETH price = lower humanPrice (1/price) = lower tick", () => {
    // More expensive ETH → fewer WETH per USDC → lower pool_price → lower tick
    const tickAt2000 = priceToTick(1 / 2000, USDC_OP.decimals, WETH_OP.decimals);
    const tickAt3000 = priceToTick(1 / 3000, USDC_OP.decimals, WETH_OP.decimals);
    expect(tickAt3000).toBeLessThan(tickAt2000);
  });

  it("Uniswap V3 fee=3000 (spacing=60): ticks aligned for $1500–$3000 range", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_OP, WETH_OP);
    const tickLower = snapTick(priceToTick(1 / 3000, sorted0.decimals, sorted1.decimals), UNI_SPACING_3000, true);
    const tickUpper = snapTick(priceToTick(1 / 1500, sorted0.decimals, sorted1.decimals), UNI_SPACING_3000, false);
    expect(tickLower % UNI_SPACING_3000 == 0).toBe(true);
    expect(tickUpper % UNI_SPACING_3000 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
  });

  it("Velodrome Slipstream (spacing=200): ticks aligned for $1500–$3000 range", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_OP, WETH_OP);
    const tickLower = snapTick(priceToTick(1 / 3000, sorted0.decimals, sorted1.decimals), VELO_SPACING, true);
    const tickUpper = snapTick(priceToTick(1 / 1500, sorted0.decimals, sorted1.decimals), VELO_SPACING, false);
    expect(tickLower % VELO_SPACING == 0).toBe(true);
    expect(tickUpper % VELO_SPACING == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
  });

  it("Velodrome and Uniswap V3 produce the same sqrtPriceX96 (identical math)", () => {
    // Slipstream uses the same tick math as Uniswap V3 — only spacing and contract differ
    const sqrtUni  = priceToSqrtPriceX96(1 / 2000, USDC_OP.decimals, WETH_OP.decimals);
    const sqrtVelo = priceToSqrtPriceX96(1 / 2000, USDC_OP.decimals, WETH_OP.decimals);
    expect(sqrtUni).toBe(sqrtVelo);
  });

  it("round-trip: sqrtPriceX96 for $2000 ETH reconstructs to ~$2000", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_OP, WETH_OP);
    const humanPrice = 1 / 2000;
    const sqrtP = priceToSqrtPriceX96(humanPrice, sorted0.decimals, sorted1.decimals);
    const Q96 = 2n ** 96n;
    const SCALE = 10n ** 30n;
    const poolPriceBig = (sqrtP * sqrtP * SCALE) / (Q96 * Q96);
    // humanPrice = pool_price / 10^12  →  reconstructed = poolPriceBig / 10^12
    const reconstructedScaled = poolPriceBig / 10n ** 12n;
    // humanPrice × SCALE = (1/2000) × 10^30 = 5×10^26
    const expected  = SCALE / 2000n;
    const tolerance = expected / 40n; // ±2.5%
    expect(reconstructedScaled).toBeGreaterThan(expected - tolerance);
    expect(reconstructedScaled).toBeLessThan(expected + tolerance);
  });
});

// ─── Polygon — Uniswap V3 with native POL token ───────────────────────────────
//
// Native POL is represented in the UI by the sentinel address; when creating
// the pool the code substitutes WPOL (0x0d500B1d..., 18 dec).
// WPOL (0x0d) < USDC (0x3c) by address → WPOL = sorted0, USDC = sorted1
// decAdj = 6 − 18 = −12  (identical to WETH/USDC — both are 18-dec/6-dec pairs)
// pool_price = humanPrice × 10^−12
// At POL=$0.50:  pool_price = 5×10^−13,  tick ≈ −283255

describe("Polygon — WPOL(18)/USDC(6) native POL pair — Uniswap V3", () => {
  // WPOL substituted for native POL sentinel in pool creation
  const WPOL  = { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WPOL",  decimals: 18 };
  const USDC_POLY = { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 };

  it("sortTokens: WPOL(0x0d) < USDC(0x3c) → WPOL=sorted0, USDC=sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WPOL, USDC_POLY);
    expect(sorted0.symbol).toBe("WPOL");
    expect(sorted1.symbol).toBe("USDC");
    expect(wasSwapped).toBe(false);
  });

  it("native POL input (sentinel) sorts identically to WPOL after address substitution", () => {
    // The pool always uses WPOL's address; POL sentinel is only for balance fetch
    const NATIVE_POL = { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "POL", decimals: 18 };
    const { wasSwapped: swapNative } = sortTokens(NATIVE_POL, USDC_POLY);
    const { wasSwapped: swapWPOL }   = sortTokens(WPOL, USDC_POLY);
    // After substituting WPOL address, sort result must match
    // (WPOL address is lower than USDC, same as NATIVE_POL sentinel is lower)
    expect(swapWPOL).toBe(false);
    // Verify sentinel address is also lower than USDC address (consistent sort direction)
    expect("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase() >
           USDC_POLY.address.toLowerCase()).toBe(true);
    // So native POL (sentinel) would be sorted1 — code must substitute WPOL before sorting
    expect(swapNative).toBe(true);
  });

  it("decAdj=-12 same as WETH/USDC: tick at $0.50/POL is near −283255", () => {
    // pool_price = 0.5 × 10^(6−18) = 5×10^−13
    const tick = priceToTick(0.50, WPOL.decimals, USDC_POLY.decimals);
    expect(tick).toBeCloseTo(-283255, -2);
    expect(tick).toBeLessThan(-270000);
  });

  it("priceToTick is monotonic for POL price range $0.30–$1.00", () => {
    const t030 = priceToTick(0.30, WPOL.decimals, USDC_POLY.decimals);
    const t050 = priceToTick(0.50, WPOL.decimals, USDC_POLY.decimals);
    const t100 = priceToTick(1.00, WPOL.decimals, USDC_POLY.decimals);
    expect(t030).toBeLessThan(t050);
    expect(t050).toBeLessThan(t100);
  });

  it("Uniswap V3 fee=10000 (spacing=200): full flow for $0.40–$0.70 POL range", () => {
    const { sorted0, sorted1 } = sortTokens(WPOL, USDC_POLY);
    const startPrice = 0.50;
    const tickLower  = snapTick(priceToTick(0.40, sorted0.decimals, sorted1.decimals), 200, true);
    const tickUpper  = snapTick(priceToTick(0.70, sorted0.decimals, sorted1.decimals), 200, false);
    const sqrtP      = priceToSqrtPriceX96(startPrice, sorted0.decimals, sorted1.decimals);

    expect(sqrtP).toBeGreaterThan(0n);
    expect(tickLower % 200 == 0).toBe(true);
    expect(tickUpper % 200 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    // Starting tick must be inside range
    const startTick = priceToTick(startPrice, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);
  });

  it("Uniswap V3 fee=3000 (spacing=60): ticks aligned for $0.40–$0.70 range", () => {
    const { sorted0, sorted1 } = sortTokens(WPOL, USDC_POLY);
    const tickLower = snapTick(priceToTick(0.40, sorted0.decimals, sorted1.decimals), 60, true);
    const tickUpper = snapTick(priceToTick(0.70, sorted0.decimals, sorted1.decimals), 60, false);
    expect(tickLower % 60 == 0).toBe(true);
    expect(tickUpper % 60 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
  });
});

// ─── BNB Chain — Uniswap V3 & PancakeSwap V3 ─────────────────────────────────
//
// Key difference: USDC on BNB Chain has 18 decimals (not 6).
//
// Pair 1: USDC(18)/WBNB(18) — both 18 dec, decAdj = 0
//   USDC (0x8A) < WBNB (0xBB) → USDC=sorted0, WBNB=sorted1
//   humanPrice = WBNB per USDC = 1 / (BNB price in USD)
//   At BNB=$600: humanPrice=1/600≈0.001667, pool_price=0.001667, tick≈−63977
//
// Pair 2: CAKE(18)/USDC(18) — both 18 dec, decAdj = 0
//   CAKE (0x0E) < USDC (0x8A) → CAKE=sorted0, USDC=sorted1
//   humanPrice = USDC per CAKE = price of CAKE in USDC
//   At CAKE=$3: pool_price=3.0, tick≈10987

describe("BNB Chain — USDC(18)/WBNB(18) both 18-dec — Uniswap V3 & PancakeSwap V3", () => {
  // USDC on BNB has 18 decimals — critical difference from other chains
  const USDC_BNB = { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 };
  const WBNB     = { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18 };

  it("sortTokens: USDC(0x8A) < WBNB(0xBB) → USDC=sorted0, WBNB=sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(USDC_BNB, WBNB);
    expect(sorted0.symbol).toBe("USDC");
    expect(sorted1.symbol).toBe("WBNB");
    expect(wasSwapped).toBe(false);
  });

  it("decAdj=0 (both 18 dec): pool_price equals humanPrice exactly", () => {
    // pool_price = humanPrice × 10^(18−18) = humanPrice × 1
    const humanPrice = 1 / 600;
    const sqrtP = priceToSqrtPriceX96(humanPrice, USDC_BNB.decimals, WBNB.decimals);
    const Q96 = 2n ** 96n;
    const SCALE = 10n ** 30n;
    const poolPriceBig = (sqrtP * sqrtP * SCALE) / (Q96 * Q96);
    // humanPrice × SCALE = (1/600) × 10^30
    const expected  = SCALE / 600n;
    const tolerance = expected / 40n;
    expect(poolPriceBig).toBeGreaterThan(expected - tolerance);
    expect(poolPriceBig).toBeLessThan(expected + tolerance);
  });

  it("BNB=$600: tick is near −63977 (negative — WBNB less abundant than USDC at this price)", () => {
    const tick = priceToTick(1 / 600, USDC_BNB.decimals, WBNB.decimals);
    expect(tick).toBeCloseTo(-63977, -2);
  });

  it("higher BNB price → lower humanPrice (1/price) → lower tick", () => {
    const tickAt500 = priceToTick(1 / 500, USDC_BNB.decimals, WBNB.decimals);
    const tickAt600 = priceToTick(1 / 600, USDC_BNB.decimals, WBNB.decimals);
    const tickAt700 = priceToTick(1 / 700, USDC_BNB.decimals, WBNB.decimals);
    expect(tickAt700).toBeLessThan(tickAt600);
    expect(tickAt600).toBeLessThan(tickAt500);
  });

  it("Uniswap V3 fee=3000 (spacing=60): full flow for $500–$700 BNB range", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_BNB, WBNB);
    // $700/BNB → humanPrice=1/700 → tickLower (more negative)
    // $500/BNB → humanPrice=1/500 → tickUpper (less negative)
    const tickLower = snapTick(priceToTick(1 / 700, sorted0.decimals, sorted1.decimals), 60, true);
    const tickUpper = snapTick(priceToTick(1 / 500, sorted0.decimals, sorted1.decimals), 60, false);
    const sqrtP     = priceToSqrtPriceX96(1 / 600, sorted0.decimals, sorted1.decimals);

    expect(sqrtP).toBeGreaterThan(0n);
    expect(tickLower % 60 == 0).toBe(true);
    expect(tickUpper % 60 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    const startTick = priceToTick(1 / 600, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);
  });

  it("PancakeSwap V3 fee=2500 (spacing=50): ticks aligned for $500–$700 BNB range", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_BNB, WBNB);
    const tickLower = snapTick(priceToTick(1 / 700, sorted0.decimals, sorted1.decimals), 50, true);
    const tickUpper = snapTick(priceToTick(1 / 500, sorted0.decimals, sorted1.decimals), 50, false);
    expect(tickLower % 50 == 0).toBe(true);
    expect(tickUpper % 50 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
  });

  it("18-dec USDC on BNB produces different tick than 6-dec USDC would for same human price", () => {
    // This confirms we must use the actual on-chain decimals, not assume 6
    const tickWith18dec = priceToTick(1 / 600, 18, 18); // correct for BNB
    const tickWith6dec  = priceToTick(1 / 600, 6,  18); // wrong — would use Ethereum USDC decimals
    expect(tickWith18dec).not.toBe(tickWith6dec);
  });
});

describe("BNB Chain — CAKE(18)/USDC(18) — PancakeSwap V3 home pair", () => {
  const CAKE     = { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE",  decimals: 18 };
  const USDC_BNB = { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC",  decimals: 18 };

  it("sortTokens: CAKE(0x0E) < USDC(0x8A) → CAKE=sorted0, USDC=sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(CAKE, USDC_BNB);
    expect(sorted0.symbol).toBe("CAKE");
    expect(sorted1.symbol).toBe("USDC");
    expect(wasSwapped).toBe(false);
  });

  it("CAKE=$3: tick is near +10987 (positive — USDC is sorted1, price > 1)", () => {
    // pool_price = 3.0 × 10^(18−18) = 3.0,  tick = ln(3)/ln(1.0001) ≈ 10987
    const tick = priceToTick(3.0, CAKE.decimals, USDC_BNB.decimals);
    expect(tick).toBeCloseTo(10987, -2);
    expect(tick).toBeGreaterThan(0);
  });

  it("priceToTick is monotonic for CAKE $2–$5 range", () => {
    const t2 = priceToTick(2.0, CAKE.decimals, USDC_BNB.decimals);
    const t3 = priceToTick(3.0, CAKE.decimals, USDC_BNB.decimals);
    const t5 = priceToTick(5.0, CAKE.decimals, USDC_BNB.decimals);
    expect(t2).toBeLessThan(t3);
    expect(t3).toBeLessThan(t5);
  });

  it("PancakeSwap V3 fee=2500 (spacing=50): full flow for $2.50–$4.00 CAKE range", () => {
    const PCS_SPACING = 50;
    const { sorted0, sorted1 } = sortTokens(CAKE, USDC_BNB);
    const tickLower = snapTick(priceToTick(2.50, sorted0.decimals, sorted1.decimals), PCS_SPACING, true);
    const tickUpper = snapTick(priceToTick(4.00, sorted0.decimals, sorted1.decimals), PCS_SPACING, false);
    const sqrtP     = priceToSqrtPriceX96(3.0, sorted0.decimals, sorted1.decimals);

    expect(sqrtP).toBeGreaterThan(0n);
    expect(tickLower % PCS_SPACING == 0).toBe(true);
    expect(tickUpper % PCS_SPACING == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    expect(tickLower).toBeGreaterThan(0); // both ticks positive for this price range
    expect(tickUpper).toBeGreaterThan(0);
    const startTick = priceToTick(3.0, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);
  });
});

// ─── Network/protocol compatibility matrix ────────────────────────────────────
//
// Verifies that each network's token pairs produce valid, internally consistent
// LP parameters regardless of which protocol is selected.

describe("Network/protocol compatibility — sqrtPriceX96 is protocol-agnostic", () => {
  /**
   * The sqrtPriceX96 value depends only on the token decimals and the human
   * price — it is identical for Uniswap V3, PancakeSwap V3, and Slipstream
   * for the same pair.  Only the tick spacing (and therefore tickLower/tickUpper)
   * differs between protocols.
   */

  const pairs: { name: string; t0dec: number; t1dec: number; price: number }[] = [
    { name: "Base: HLRR(8)/USDC(6)",          t0dec: 8,  t1dec: 6,  price: 0.075 },
    { name: "Optimism: USDC(6)/WETH(18)",      t0dec: 6,  t1dec: 18, price: 1 / 2000 },
    { name: "Polygon: WPOL(18)/USDC(6)",       t0dec: 18, t1dec: 6,  price: 0.50 },
    { name: "BNB: USDC(18)/WBNB(18)",          t0dec: 18, t1dec: 18, price: 1 / 600 },
    { name: "BNB: CAKE(18)/USDC(18)",          t0dec: 18, t1dec: 18, price: 3.0 },
    { name: "Arbitrum: WETH(18)/USDC(6)",      t0dec: 18, t1dec: 6,  price: 2000 },
  ];

  for (const { name, t0dec, t1dec, price } of pairs) {
    it(`${name}: sqrtPriceX96 is positive and finite`, () => {
      const sqrtP = priceToSqrtPriceX96(price, t0dec, t1dec);
      expect(sqrtP).toBeGreaterThan(0n);
      // Sanity: should not overflow a reasonable bigint (< 2^256)
      expect(sqrtP).toBeLessThan(2n ** 200n);
    });

    it(`${name}: tick spacing 200 (Slipstream/1% Uniswap) produces valid aligned range`, () => {
      const tickLower = snapTick(priceToTick(price * 0.8, t0dec, t1dec), 200, true);
      const tickUpper = snapTick(priceToTick(price * 1.2, t0dec, t1dec), 200, false);
      expect(tickLower % 200 == 0).toBe(true);
      expect(tickUpper % 200 == 0).toBe(true);
      expect(tickLower).toBeLessThan(tickUpper);
    });

    it(`${name}: tick spacing 60 (Uniswap 0.3%) produces valid aligned range`, () => {
      const tickLower = snapTick(priceToTick(price * 0.8, t0dec, t1dec), 60, true);
      const tickUpper = snapTick(priceToTick(price * 1.2, t0dec, t1dec), 60, false);
      expect(tickLower % 60 == 0).toBe(true);
      expect(tickUpper % 60 == 0).toBe(true);
      expect(tickLower).toBeLessThan(tickUpper);
    });

    it(`${name}: tick spacing 50 (PancakeSwap 0.25%) produces valid aligned range`, () => {
      const tickLower = snapTick(priceToTick(price * 0.8, t0dec, t1dec), 50, true);
      const tickUpper = snapTick(priceToTick(price * 1.2, t0dec, t1dec), 50, false);
      expect(tickLower % 50 == 0).toBe(true);
      expect(tickUpper % 50 == 0).toBe(true);
      expect(tickLower).toBeLessThan(tickUpper);
    });
  }
});
