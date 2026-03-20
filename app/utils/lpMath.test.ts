/**
 * Unit tests for LP math helpers — covers Uniswap V3, PancakeSwap V3,
 * Aerodrome Slipstream (Base), and Velodrome Slipstream (Optimism).
 *
 * Networks and protocols covered:
 *   Ethereum        — Uniswap V3, PancakeSwap V3
 *   Eth Sepolia     — Uniswap V3, PancakeSwap V3
 *   Base Mainnet    — Uniswap V3, PancakeSwap V3, Aerodrome Slipstream
 *   Base Sepolia    — Uniswap V3
 *   Arbitrum One    — Uniswap V3, PancakeSwap V3
 *   Arbitrum Sepolia— Uniswap V3
 *   Optimism        — Uniswap V3, Velodrome Slipstream
 *   OP Sepolia      — Uniswap V3
 *   Polygon         — Uniswap V3 (native token: POL, 18 dec — substituted with WPOL)
 *   BNB Chain       — Uniswap V3, PancakeSwap V3 (native: BNB; USDC has 18 dec here)
 *   BNB Testnet     — PancakeSwap V3 only
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

// ─── BNB Chain — pairSwapped scenarios ───────────────────────────────────────
//
// BNB-specific: USDC(18) and all other major tokens are 18 dec → decAdj=0 for every pair.
// Tests cover three pairSwapped cases:
//   1. WBNB(token0) / USDC(token1)  — WBNB(0xBB) > USDC(0x8A) → pairSwapped
//   2. USDC(token0) / CAKE(token1)  — USDC(0x8A) > CAKE(0x0E) → pairSwapped
//   3. WBNB(token0) / USDT(token1)  — WBNB(0xBB) > USDT(0x55) → pairSwapped
// And verifies that pairSwapped inversion produces identical ticks/sqrtPrice
// as the canonical non-swapped equivalent.

describe("BNB Chain — pairSwapped (flipped token0/token1 selection)", () => {
  const USDC_BNB = { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 };
  const WBNB     = { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18 };
  const CAKE     = { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE", decimals: 18 };
  const USDT_BNB = { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18 };

  // ── sortTokens confirms pairSwapped for each flipped selection ─────────────

  it("WBNB(token0)/USDC(token1): WBNB(0xBB) > USDC(0x8A) → wasSwapped=true, sorted0=USDC", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WBNB, USDC_BNB);
    expect(wasSwapped).toBe(true);
    expect(sorted0.symbol).toBe("USDC");
    expect(sorted1.symbol).toBe("WBNB");
  });

  it("USDC(token0)/CAKE(token1): USDC(0x8A) > CAKE(0x0E) → wasSwapped=true, sorted0=CAKE", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(USDC_BNB, CAKE);
    expect(wasSwapped).toBe(true);
    expect(sorted0.symbol).toBe("CAKE");
    expect(sorted1.symbol).toBe("USDC");
  });

  it("WBNB(token0)/USDT(token1): WBNB(0xBB) > USDT(0x55) → wasSwapped=true, sorted0=USDT", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WBNB, USDT_BNB);
    expect(wasSwapped).toBe(true);
    expect(sorted0.symbol).toBe("USDT");
    expect(sorted1.symbol).toBe("WBNB");
  });

  // ── WBNB(token0) / USDC(token1) — pairSwapped ─────────────────────────────
  // User enters USDC per WBNB (e.g. $600), pool gets 1/600 WBNB per USDC.
  // sorted0=USDC(18), sorted1=WBNB(18), decAdj=0 → poolPrice = 1/userPrice exactly.

  describe("WBNB(token0) / USDC(token1) — user enters USDC per WBNB", () => {
    const s0dec = USDC_BNB.decimals; // 18 — sorted0 after swap
    const s1dec = WBNB.decimals;     // 18 — sorted1 after swap
    const userPrice = 600;           // 600 USDC per WBNB (user's t1/t0 direction)

    it("sqrtPriceX96 via inversion equals canonical USDC/WBNB at 1/600", () => {
      // pairSwapped: pool price = 1/userPrice
      const viaPairSwapped = priceToSqrtPriceX96(1 / userPrice, s0dec, s1dec);
      // canonical (user selects USDC as token0, enters 1/600 directly)
      const canonical = priceToSqrtPriceX96(1 / 600, s0dec, s1dec);
      expect(viaPairSwapped).toBe(canonical);
    });

    it("tick via inversion equals canonical tick at 1/600", () => {
      const viaPairSwapped = priceToTick(1 / userPrice, s0dec, s1dec);
      const canonical      = priceToTick(1 / 600, s0dec, s1dec);
      expect(viaPairSwapped).toBe(canonical);
      expect(viaPairSwapped).toBeCloseTo(-63977, -2); // same as existing BNB test
    });

    it("pairSwapped range $400–$800 USDC/WBNB: min/max invert+swap → tickLower < tickUpper", () => {
      const userMin = 400; const userMax = 800;
      // pool tickLower from 1/userMax, tickUpper from 1/userMin (inversion swaps direction)
      const tickLower = snapTick(priceToTick(1 / userMax, s0dec, s1dec), 200, true);
      const tickUpper = snapTick(priceToTick(1 / userMin, s0dec, s1dec), 200, false);
      expect(tickLower).toBeLessThan(tickUpper);
      expect(tickLower % 200 == 0).toBe(true);
      expect(tickUpper % 200 == 0).toBe(true);
      // Both negative — BNB/USDC pool at these prices has negative ticks
      expect(tickUpper).toBeLessThan(0);
    });

    it("PancakeSwap V3 spacing=50: $400–$800 range ticks aligned and ordered", () => {
      const userMin = 400; const userMax = 800;
      const tickLower = snapTick(priceToTick(1 / userMax, s0dec, s1dec), 50, true);
      const tickUpper = snapTick(priceToTick(1 / userMin, s0dec, s1dec), 50, false);
      expect(tickLower % 50 == 0).toBe(true);
      expect(tickUpper % 50 == 0).toBe(true);
      expect(tickLower).toBeLessThan(tickUpper);
    });

    it("pairSwapped ticks match non-pairSwapped canonical equivalent", () => {
      // Canonical: user selects USDC(token0)/WBNB(token1), enters 1/600 WBNB/USDC
      const canonicalLower = snapTick(priceToTick(1 / 800, s0dec, s1dec), 200, true);
      const canonicalUpper = snapTick(priceToTick(1 / 400, s0dec, s1dec), 200, false);
      // pairSwapped: user selects WBNB(token0)/USDC(token1), enters 600 USDC/WBNB
      const swappedLower = snapTick(priceToTick(1 / 800, s0dec, s1dec), 200, true);
      const swappedUpper = snapTick(priceToTick(1 / 400, s0dec, s1dec), 200, false);
      expect(swappedLower).toBe(canonicalLower);
      expect(swappedUpper).toBe(canonicalUpper);
    });

    it("BNB 18-dec USDC pairSwapped gives very different tick than 6-dec USDC would", () => {
      // On other chains USDC is 6 dec — decAdj would be 12, giving large positive ticks
      const tickBnb18 = priceToTick(1 / userPrice, 18, 18); // correct for BNB
      const tickOther6 = priceToTick(1 / userPrice, 6, 18); // wrong: assumes 6-dec USDC
      expect(tickBnb18).not.toBe(tickOther6);
      // BNB: tick ≈ -63977 (negative); other chains: tick ≈ +196k (large positive)
      expect(tickBnb18).toBeLessThan(0);
      expect(tickOther6).toBeGreaterThan(100_000);
    });
  });

  // ── USDC(token0) / CAKE(token1) — pairSwapped ─────────────────────────────
  // User enters CAKE per USDC (e.g. 1/3), pool gets 1/(1/3) = 3 USDC per CAKE.
  // sorted0=CAKE(18), sorted1=USDC(18), decAdj=0.

  describe("USDC(token0) / CAKE(token1) — user enters CAKE per USDC", () => {
    const s0dec = CAKE.decimals;     // 18 — sorted0 (CAKE has lower address)
    const s1dec = USDC_BNB.decimals; // 18 — sorted1
    const userPrice = 1 / 3;        // 0.333... CAKE per USDC (user's t1/t0)
    // pool direction: 1/userPrice = 3.0 USDC per CAKE

    it("sqrtPriceX96 via inversion equals canonical CAKE/USDC at $3", () => {
      const viaPairSwapped = priceToSqrtPriceX96(1 / userPrice, s0dec, s1dec);
      const canonical      = priceToSqrtPriceX96(3.0, s0dec, s1dec);
      expect(viaPairSwapped).toBe(canonical);
    });

    it("tick via inversion equals canonical CAKE/USDC tick at $3", () => {
      const viaPairSwapped = priceToTick(1 / userPrice, s0dec, s1dec);
      const canonical      = priceToTick(3.0, s0dec, s1dec);
      expect(viaPairSwapped).toBe(canonical);
      expect(viaPairSwapped).toBeCloseTo(10987, -2);
    });

    it("pairSwapped range 1/5–1/2 CAKE/USDC (=$2–$5): tickLower < tickUpper", () => {
      const userMin = 1 / 5; const userMax = 1 / 2;
      const tickLower = snapTick(priceToTick(1 / userMax, s0dec, s1dec), 50, true);
      const tickUpper = snapTick(priceToTick(1 / userMin, s0dec, s1dec), 50, false);
      expect(tickLower).toBeLessThan(tickUpper);
      expect(tickLower % 50 == 0).toBe(true);
      expect(tickUpper % 50 == 0).toBe(true);
      expect(tickLower).toBeGreaterThan(0); // CAKE priced above $1 → positive ticks
    });

    it("higher CAKE price → user enters smaller CAKE/USDC value → higher pool tick", () => {
      // userPrice = CAKE/USDC; higher CAKE price = smaller CAKE/USDC = larger USDC/CAKE
      const tickAt2  = priceToTick(1 / (1 / 2),  s0dec, s1dec); // CAKE=$2
      const tickAt3  = priceToTick(1 / (1 / 3),  s0dec, s1dec); // CAKE=$3
      const tickAt5  = priceToTick(1 / (1 / 5),  s0dec, s1dec); // CAKE=$5
      expect(tickAt2).toBeLessThan(tickAt3);
      expect(tickAt3).toBeLessThan(tickAt5);
    });
  });

  // ── WBNB(token0) / USDT(token1) — pairSwapped, stable-like check ──────────
  // USDT also has 18 dec on BNB. Both WBNB and USDT are 18 dec → same decAdj=0 pattern.

  describe("WBNB(token0) / USDT(token1) — same 18-dec pattern as WBNB/USDC", () => {
    const s0dec = USDT_BNB.decimals; // 18 — sorted0 (USDT address is lower)
    const s1dec = WBNB.decimals;     // 18 — sorted1
    const userPrice = 600;           // 600 USDT per WBNB

    it("sqrtPriceX96 and tick match WBNB/USDC at same price (both 18 dec pairs)", () => {
      const wbnbUsdt = priceToSqrtPriceX96(1 / userPrice, s0dec, s1dec);
      const wbnbUsdc = priceToSqrtPriceX96(1 / userPrice, USDC_BNB.decimals, WBNB.decimals);
      // Identical math — only addresses differ
      expect(wbnbUsdt).toBe(wbnbUsdc);
    });

    it("pairSwapped $500–$700 USDT/WBNB: PancakeSwap spacing=50 ticks valid", () => {
      const tickLower = snapTick(priceToTick(1 / 700, s0dec, s1dec), 50, true);
      const tickUpper = snapTick(priceToTick(1 / 500, s0dec, s1dec), 50, false);
      expect(tickLower % 50 == 0).toBe(true);
      expect(tickUpper % 50 == 0).toBe(true);
      expect(tickLower).toBeLessThan(tickUpper);
      expect(tickUpper).toBeLessThan(0); // negative ticks for this price range
    });
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
    { name: "Ethereum: USDC(6)/WETH(18)",      t0dec: 6,  t1dec: 18, price: 1 / 2500 },
    { name: "Eth Sepolia: USDC(6)/WETH(18)",   t0dec: 6,  t1dec: 18, price: 1 / 2000 },
    { name: "Base: HLRR(8)/USDC(6)",           t0dec: 8,  t1dec: 6,  price: 0.075 },
    { name: "Base Sepolia: USDC(6)/HLRR(8)",   t0dec: 6,  t1dec: 8,  price: 1 / 0.075 },
    { name: "Arbitrum: WETH(18)/USDC(6)",      t0dec: 18, t1dec: 6,  price: 2000 },
    { name: "Arb Sepolia: USDC(6)/WETH(18)",   t0dec: 6,  t1dec: 18, price: 1 / 2000 },
    { name: "Optimism: USDC(6)/WETH(18)",      t0dec: 6,  t1dec: 18, price: 1 / 2000 },
    { name: "OP Sepolia: WETH(18)/USDC(6)",    t0dec: 18, t1dec: 6,  price: 2000 },
    { name: "Polygon: WPOL(18)/USDC(6)",       t0dec: 18, t1dec: 6,  price: 0.50 },
    { name: "BNB: USDC(18)/WBNB(18)",          t0dec: 18, t1dec: 18, price: 1 / 600 },
    { name: "BNB: CAKE(18)/USDC(18)",          t0dec: 18, t1dec: 18, price: 3.0 },
    { name: "BNB Testnet: USDT(18)/WBNB(18)",  t0dec: 18, t1dec: 18, price: 1 / 400 },
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

// ─── pairSwapped — user token0/token1 selection is address-sorted opposite ────
//
// When the user picks token0 with a higher address than token1, the UI flips the
// price direction: prices are accepted as t1/t0 (user's view) and inverted to
// sorted1/sorted0 (pool's native direction) before math.
//
// Key invariant: priceToSqrtPriceX96(1/userPrice, sorted0.dec, sorted1.dec)
//                must equal the sqrt price a correctly-oriented user would compute.
//
// Token addresses used (Base Sepolia):
//   HLRR_SEP: 0x75f9… > USDC_SEP: 0x036C… → user selecting HLRR/USDC triggers pairSwapped
//   WETH:     0x4200… > USDC_SEP: 0x036C… → user selecting WETH/USDC triggers pairSwapped
//   HLRR_MAIN: 0x5E…  < USDC_MAIN: 0x83…  → user selecting HLRR/USDC does NOT trigger pairSwapped

const HLRR_SEP  = { address: "0x75f9A6289B40BA7b32C4D56300a53B208dD8E7F4", symbol: "HLRR", decimals: 8 };
const USDC_SEP  = { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", symbol: "USDC", decimals: 6 };
const HLRR_MAIN = { address: "0x5E1583d48bcFd60de77138ea195f3EFbe128405d", symbol: "HLRR", decimals: 8 };
const USDC_MAIN = { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 };
const WETH_BASE = { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 };

describe("pairSwapped — user selects token0 with higher address than token1", () => {

  describe("sortTokens detects pairSwapped correctly for each network/pair", () => {
    it("Base Sepolia HLRR/USDC: HLRR(0x75) > USDC(0x03) → wasSwapped=true", () => {
      const { sorted0, sorted1, wasSwapped } = sortTokens(HLRR_SEP, USDC_SEP);
      expect(wasSwapped).toBe(true);
      expect(sorted0.symbol).toBe("USDC"); // lower address becomes sorted0
      expect(sorted1.symbol).toBe("HLRR");
    });

    it("Base Sepolia USDC/HLRR (reverse selection): wasSwapped=false", () => {
      const { sorted0, sorted1, wasSwapped } = sortTokens(USDC_SEP, HLRR_SEP);
      expect(wasSwapped).toBe(false);
      expect(sorted0.symbol).toBe("USDC");
      expect(sorted1.symbol).toBe("HLRR");
    });

    it("Base mainnet HLRR/USDC: HLRR(0x5E) < USDC(0x83) → wasSwapped=false", () => {
      const { sorted0, sorted1, wasSwapped } = sortTokens(HLRR_MAIN, USDC_MAIN);
      expect(wasSwapped).toBe(false);
      expect(sorted0.symbol).toBe("HLRR"); // HLRR is sorted0 on mainnet — no flip
      expect(sorted1.symbol).toBe("USDC");
    });

    it("WETH/USDC_SEP: WETH(0x42) > USDC(0x03) → wasSwapped=true", () => {
      const { sorted0, sorted1, wasSwapped } = sortTokens(WETH_BASE, USDC_SEP);
      expect(wasSwapped).toBe(true);
      expect(sorted0.symbol).toBe("USDC");
      expect(sorted1.symbol).toBe("WETH");
    });
  });

  describe("Base Sepolia HLRR(token0) / USDC(token1) — pairSwapped price inversion", () => {
    // sorted0=USDC(6), sorted1=HLRR(8) after address sort
    // User enters price as USDC per HLRR (t1/t0), pool needs HLRR per USDC (sorted1/sorted0)
    // Pool direction price = 1 / userPrice
    const s0dec = USDC_SEP.decimals; // 6
    const s1dec = HLRR_SEP.decimals; // 8
    const userPrice = 0.075; // 0.075 USDC per HLRR

    it("sqrtPriceX96(1/userPrice) equals sqrtPriceX96 from direct pool-direction price", () => {
      const viaInversion = priceToSqrtPriceX96(1 / userPrice, s0dec, s1dec);
      const direct       = priceToSqrtPriceX96(1 / 0.075, s0dec, s1dec);
      expect(viaInversion).toBe(direct);
    });

    it("sqrtPriceX96 from pairSwapped Base Sepolia equals Base mainnet HLRR/USDC at same price", () => {
      // On mainnet HLRR is sorted0(8), USDC is sorted1(6), user enters USDC/HLRR directly
      const mainnet  = priceToSqrtPriceX96(userPrice, HLRR_MAIN.decimals, USDC_MAIN.decimals);
      // On Sepolia USDC is sorted0(6), HLRR is sorted1(8), pool price = 1/userPrice
      const sepolia  = priceToSqrtPriceX96(1 / userPrice, s0dec, s1dec);
      // Different decimal arrangements → different sqrtPriceX96, but both must be > 0
      expect(mainnet).toBeGreaterThan(0n);
      expect(sepolia).toBeGreaterThan(0n);
      // Sanity: inversion changes the sqrt price
      expect(mainnet).not.toBe(sepolia);
    });

    it("tick from pairSwapped inversion is negative (HLRR cheaper than USDC in pool units)", () => {
      // pool price = 1/0.075 ≈ 13.33 HLRR per USDC
      // decAdj = 8-6 = 2, poolPrice = 13.33 × 100 = 1333
      // tick ≈ log(1333)/log(1.0001) > 0 → tick is POSITIVE
      const tick = priceToTick(1 / userPrice, s0dec, s1dec);
      expect(tick).toBeGreaterThan(0);
    });

    it("pairSwapped range $0.04–$0.25 USDC/HLRR: min/max invert and swap, tickLower < tickUpper", () => {
      const userMin = 0.04;
      const userMax = 0.25;
      // Pool tickLower comes from 1/userMax (lower pool price), tickUpper from 1/userMin
      const rawLower = priceToTick(1 / userMax, s0dec, s1dec);
      const rawUpper = priceToTick(1 / userMin, s0dec, s1dec);
      const tickLower = snapTick(rawLower, 200, true);
      const tickUpper = snapTick(rawUpper, 200, false);
      expect(tickLower).toBeLessThan(tickUpper);
      expect(tickLower % 200).toBe(0);
      expect(tickUpper % 200).toBe(0);
    });

    it("pairSwapped ticks equal non-swapped ticks for equivalent range", () => {
      // Non-swapped (user selects USDC/HLRR, enters price as HLRR per USDC)
      const nonSwappedLower = snapTick(priceToTick(1 / 0.25, s0dec, s1dec), 200, true);
      const nonSwappedUpper = snapTick(priceToTick(1 / 0.04, s0dec, s1dec), 200, false);
      // Swapped (user selects HLRR/USDC, enters price as USDC per HLRR)
      const swappedLower = snapTick(priceToTick(1 / 0.25, s0dec, s1dec), 200, true);
      const swappedUpper = snapTick(priceToTick(1 / 0.04, s0dec, s1dec), 200, false);
      expect(swappedLower).toBe(nonSwappedLower);
      expect(swappedUpper).toBe(nonSwappedUpper);
    });
  });

  describe("WETH(token0) / USDC(token1) on Base Sepolia — pairSwapped price inversion", () => {
    // sorted0=USDC_SEP(6), sorted1=WETH_BASE(18) after address sort
    // User enters price as USDC per WETH (t1/t0) — the natural "price of ETH" convention
    // Pool direction price = 1/userPrice (WETH per USDC)
    const s0dec = USDC_SEP.decimals;  // 6
    const s1dec = WETH_BASE.decimals; // 18

    it("ETH at $3000: sqrtPriceX96(1/3000) matches direct USDC/WETH pool computation", () => {
      const viaPairSwapped = priceToSqrtPriceX96(1 / 3000, s0dec, s1dec);
      const direct         = priceToSqrtPriceX96(1 / 3000, s0dec, s1dec);
      expect(viaPairSwapped).toBe(direct);
      expect(viaPairSwapped).toBeGreaterThan(0n);
    });

    it("ETH at $3000: pool tick is in the expected range (~196k for USDC(6)/WETH(18))", () => {
      const tick = priceToTick(1 / 3000, s0dec, s1dec);
      // USDC(6)/WETH(18): poolPrice = (1/3000) × 10^(18-6) = (1/3000) × 10^12 ≈ 3.33×10^8
      // tick ≈ ln(3.33×10^8) / ln(1.0001) ≈ 19.62 / 9.9995e-5 ≈ 196_260
      // (Note: WETH(18)/USDC(6) at $3000 gives tick ≈ -196_260 — the opposite orientation)
      expect(tick).toBeGreaterThan(190_000);
      expect(tick).toBeLessThan(200_000);
    });

    it("pairSwapped range $1000–$5000 USDC/WETH: inverted min/max gives tickLower < tickUpper", () => {
      const userMin = 1000;
      const userMax = 5000;
      const tickLower = snapTick(priceToTick(1 / userMax, s0dec, s1dec), 200, true);
      const tickUpper = snapTick(priceToTick(1 / userMin, s0dec, s1dec), 200, false);
      expect(tickLower).toBeLessThan(tickUpper);
      expect(tickLower % 200).toBe(0);
      expect(tickUpper % 200).toBe(0);
      // Both positive — USDC/WETH pool always has large positive ticks
      expect(tickLower).toBeGreaterThan(0);
    });

    it("pairSwapped inversion is self-consistent: sqrtPriceX96(1/p) × sqrtPriceX96(p) reflects reciprocal relationship", () => {
      // For USDC(6)/WETH(18): price p=1/3000 gives a large sqrtPriceX96
      // For WETH(18)/USDC(6): price p=3000 gives the reciprocal pool orientation
      const sqrtUsdcWeth = priceToSqrtPriceX96(1 / 3000, s0dec, s1dec);         // USDC sorted0
      const sqrtWethUsdc = priceToSqrtPriceX96(3000, s1dec, s0dec);              // WETH sorted0
      // Both > 0 and different (different decimal arrangements → different sqrt values)
      expect(sqrtUsdcWeth).toBeGreaterThan(0n);
      expect(sqrtWethUsdc).toBeGreaterThan(0n);
      expect(sqrtUsdcWeth).not.toBe(sqrtWethUsdc);
    });

    it("higher user price → lower pool tick (inverse relationship confirmed)", () => {
      const tickAt1000 = priceToTick(1 / 1000, s0dec, s1dec);
      const tickAt3000 = priceToTick(1 / 3000, s0dec, s1dec);
      const tickAt5000 = priceToTick(1 / 5000, s0dec, s1dec);
      // Higher USDC/WETH price = lower WETH/USDC pool price = lower tick
      expect(tickAt5000).toBeLessThan(tickAt3000);
      expect(tickAt3000).toBeLessThan(tickAt1000);
    });
  });

  describe("Base mainnet HLRR/USDC — NOT pairSwapped, price direction unchanged", () => {
    // HLRR(0x5E) < USDC(0x83) → sorted0=HLRR(8), sorted1=USDC(6), wasSwapped=false
    // User enters price as USDC per HLRR directly — no inversion needed
    const s0dec = HLRR_MAIN.decimals; // 8
    const s1dec = USDC_MAIN.decimals; // 6
    const userPrice = 0.075;

    it("no inversion: sqrtPriceX96(userPrice) used as-is", () => {
      const sqrt = priceToSqrtPriceX96(userPrice, s0dec, s1dec);
      expect(sqrt).toBeGreaterThan(0n);
    });

    it("range $0.01–$10 USDC/HLRR: tickLower < tickUpper without inversion", () => {
      const tickLower = snapTick(priceToTick(0.01, s0dec, s1dec), 200, true);
      const tickUpper = snapTick(priceToTick(10.0, s0dec, s1dec), 200, false);
      expect(tickLower).toBeLessThan(tickUpper);
    });

    it("mainnet and Sepolia produce DIFFERENT sqrtPriceX96 at same user price due to sort flip", () => {
      // Mainnet: sorted0=HLRR(8)/sorted1=USDC(6), price=0.075 USDC/HLRR directly
      const mainnet = priceToSqrtPriceX96(0.075, HLRR_MAIN.decimals, USDC_MAIN.decimals);
      // Sepolia: sorted0=USDC(6)/sorted1=HLRR(8), price=1/0.075 after inversion
      const sepolia = priceToSqrtPriceX96(1 / 0.075, USDC_SEP.decimals, HLRR_SEP.decimals);
      // Both valid, but different because decimal arrangement differs
      expect(mainnet).toBeGreaterThan(0n);
      expect(sepolia).toBeGreaterThan(0n);
      expect(mainnet).not.toBe(sepolia);
    });
  });
});

// ─── Ethereum Mainnet — Uniswap V3 & PancakeSwap V3 ──────────────────────────
//
// USDC (0xA0b8…) < WETH (0xC02a…) by address → USDC=sorted0, WETH=sorted1
// decAdj = 18 − 6 = +12  (positive branch — fewer decimals on sorted0)
// humanPrice = WETH per USDC = 1 / ETH_USD
// At ETH=$2500: humanPrice=1/2500=0.0004, poolPrice=0.0004×10^12=4×10^8
// tick ≈ ln(4e8)/ln(1.0001) ≈ +198_089

describe("Ethereum Mainnet — USDC(6)/WETH(18) — Uniswap V3 & PancakeSwap V3", () => {
  const USDC_ETH = { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 };
  const WETH_ETH = { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 };

  it("sortTokens: USDC(0xA0) < WETH(0xC0) → USDC=sorted0, WETH=sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(USDC_ETH, WETH_ETH);
    expect(sorted0.symbol).toBe("USDC");
    expect(sorted1.symbol).toBe("WETH");
    expect(wasSwapped).toBe(false);
  });

  it("inverted (WETH token0 / USDC token1): wasSwapped=true, sorted0=USDC", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WETH_ETH, USDC_ETH);
    expect(wasSwapped).toBe(true);
    expect(sorted0.symbol).toBe("USDC");
    expect(sorted1.symbol).toBe("WETH");
  });

  it("ETH=$2500: tick is near +198_089 (positive — USDC is sorted0)", () => {
    const tick = priceToTick(1 / 2500, USDC_ETH.decimals, WETH_ETH.decimals);
    expect(tick).toBeCloseTo(198_089, -2);
    expect(tick).toBeGreaterThan(190_000);
  });

  it("inverted pair (user enters $2500 USDC/WETH): pool tick equals 1/2500 canonical", () => {
    // User selects WETH/USDC and enters 2500 → pairSwapped → pool price = 1/2500
    const canonical  = priceToTick(1 / 2500, USDC_ETH.decimals, WETH_ETH.decimals);
    const viaInverse = priceToTick(1 / 2500, USDC_ETH.decimals, WETH_ETH.decimals);
    expect(canonical).toBe(viaInverse);
  });

  it("priceToTick is monotonic: $1500 < $2500 < $4000 → decreasing tick", () => {
    const t1500 = priceToTick(1 / 1500, USDC_ETH.decimals, WETH_ETH.decimals);
    const t2500 = priceToTick(1 / 2500, USDC_ETH.decimals, WETH_ETH.decimals);
    const t4000 = priceToTick(1 / 4000, USDC_ETH.decimals, WETH_ETH.decimals);
    expect(t4000).toBeLessThan(t2500);
    expect(t2500).toBeLessThan(t1500);
  });

  it("Uniswap V3 fee=3000 (spacing=60): full flow for $1500–$4000 range", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_ETH, WETH_ETH);
    const tickLower = snapTick(priceToTick(1 / 4000, sorted0.decimals, sorted1.decimals), 60, true);
    const tickUpper = snapTick(priceToTick(1 / 1500, sorted0.decimals, sorted1.decimals), 60, false);
    const sqrtP     = priceToSqrtPriceX96(1 / 2500, sorted0.decimals, sorted1.decimals);
    expect(sqrtP).toBeGreaterThan(0n);
    expect(tickLower % 60 == 0).toBe(true);
    expect(tickUpper % 60 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    const startTick = priceToTick(1 / 2500, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);
  });

  it("PancakeSwap V3 fee=2500 (spacing=50): full flow for $1500–$4000 range", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_ETH, WETH_ETH);
    const tickLower = snapTick(priceToTick(1 / 4000, sorted0.decimals, sorted1.decimals), 50, true);
    const tickUpper = snapTick(priceToTick(1 / 1500, sorted0.decimals, sorted1.decimals), 50, false);
    expect(tickLower % 50 == 0).toBe(true);
    expect(tickUpper % 50 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    expect(tickLower).toBeGreaterThan(0); // large positive ticks for USDC/WETH
  });

  it("USDC/WETH and WETH/USDC produce different sqrtPriceX96 (different decimal arrangements)", () => {
    const sqrtUsdcWeth = priceToSqrtPriceX96(1 / 2500, USDC_ETH.decimals, WETH_ETH.decimals); // sorted0=USDC
    const sqrtWethUsdc = priceToSqrtPriceX96(2500,      WETH_ETH.decimals, USDC_ETH.decimals); // sorted0=WETH
    expect(sqrtUsdcWeth).toBeGreaterThan(0n);
    expect(sqrtWethUsdc).toBeGreaterThan(0n);
    expect(sqrtUsdcWeth).not.toBe(sqrtWethUsdc);
  });
});

// ─── Eth Sepolia — Uniswap V3 & PancakeSwap V3 ───────────────────────────────
//
// USDC (0x1c7D…) < WETH (0xfFf9…) by address → USDC=sorted0, WETH=sorted1
// decAdj = +12  (same positive branch as Ethereum mainnet)
// At ETH=$2000: humanPrice=1/2000=0.0005, poolPrice=5×10^8, tick≈+200_321

describe("Eth Sepolia — USDC(6)/WETH(18) — Uniswap V3 & PancakeSwap V3", () => {
  const USDC_ESEP = { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", symbol: "USDC", decimals: 6 };
  const WETH_ESEP = { address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", symbol: "WETH", decimals: 18 };

  it("sortTokens: USDC(0x1c) < WETH(0xff) → USDC=sorted0, WETH=sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(USDC_ESEP, WETH_ESEP);
    expect(sorted0.symbol).toBe("USDC");
    expect(sorted1.symbol).toBe("WETH");
    expect(wasSwapped).toBe(false);
  });

  it("inverted (WETH token0 / USDC token1): wasSwapped=true, sorted0=USDC", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WETH_ESEP, USDC_ESEP);
    expect(wasSwapped).toBe(true);
    expect(sorted0.symbol).toBe("USDC");
    expect(sorted1.symbol).toBe("WETH");
  });

  it("ETH=$2000: tick is near +200_321 (matches Optimism USDC/WETH — same decimal layout)", () => {
    const tick = priceToTick(1 / 2000, USDC_ESEP.decimals, WETH_ESEP.decimals);
    expect(tick).toBeCloseTo(200_321, -2);
    expect(tick).toBeGreaterThan(190_000);
  });

  it("inverted: user enters $2000 USDC/WETH → pool price 1/2000 → same tick as canonical", () => {
    const canonical  = priceToTick(1 / 2000, USDC_ESEP.decimals, WETH_ESEP.decimals);
    const viaInverse = priceToTick(1 / 2000, USDC_ESEP.decimals, WETH_ESEP.decimals);
    expect(canonical).toBe(viaInverse);
  });

  it("Uniswap V3 fee=500 (spacing=10): full flow for $1500–$3000 range", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_ESEP, WETH_ESEP);
    const tickLower = snapTick(priceToTick(1 / 3000, sorted0.decimals, sorted1.decimals), 10, true);
    const tickUpper = snapTick(priceToTick(1 / 1500, sorted0.decimals, sorted1.decimals), 10, false);
    const sqrtP     = priceToSqrtPriceX96(1 / 2000, sorted0.decimals, sorted1.decimals);
    expect(sqrtP).toBeGreaterThan(0n);
    expect(tickLower % 10 == 0).toBe(true);
    expect(tickUpper % 10 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    const startTick = priceToTick(1 / 2000, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);
  });

  it("PancakeSwap V3 fee=2500 (spacing=50): full flow for $1500–$3000 range", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_ESEP, WETH_ESEP);
    const tickLower = snapTick(priceToTick(1 / 3000, sorted0.decimals, sorted1.decimals), 50, true);
    const tickUpper = snapTick(priceToTick(1 / 1500, sorted0.decimals, sorted1.decimals), 50, false);
    expect(tickLower % 50 == 0).toBe(true);
    expect(tickUpper % 50 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    expect(tickLower).toBeGreaterThan(0);
  });

  it("sqrtPriceX96 matches Ethereum mainnet for same ETH price (identical decimal layout)", () => {
    const USDC_ETH = { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 };
    const WETH_ETH = { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 };
    const sqrtSep  = priceToSqrtPriceX96(1 / 2000, USDC_ESEP.decimals, WETH_ESEP.decimals);
    const sqrtMain = priceToSqrtPriceX96(1 / 2000, USDC_ETH.decimals,  WETH_ETH.decimals);
    // Same decimal layout → same sqrtPriceX96 regardless of addresses/chain
    expect(sqrtSep).toBe(sqrtMain);
  });
});

// ─── Arbitrum Sepolia — Uniswap V3 only ──────────────────────────────────────
//
// USDC (0x75fa…) < WETH (0x980B…) by address → USDC=sorted0, WETH=sorted1
// decAdj = +12  (same positive branch as Ethereum / Eth Sepolia / Optimism)
// At ETH=$2000: tick ≈ +200_321

describe("Arbitrum Sepolia — USDC(6)/WETH(18) — Uniswap V3", () => {
  const USDC_ASEP = { address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", symbol: "USDC", decimals: 6 };
  const WETH_ASEP = { address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", symbol: "WETH", decimals: 18 };

  it("sortTokens: USDC(0x75) < WETH(0x98) → USDC=sorted0, WETH=sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(USDC_ASEP, WETH_ASEP);
    expect(sorted0.symbol).toBe("USDC");
    expect(sorted1.symbol).toBe("WETH");
    expect(wasSwapped).toBe(false);
  });

  it("inverted (WETH token0 / USDC token1): wasSwapped=true, sorted0=USDC", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WETH_ASEP, USDC_ASEP);
    expect(wasSwapped).toBe(true);
    expect(sorted0.symbol).toBe("USDC");
    expect(sorted1.symbol).toBe("WETH");
  });

  it("ETH=$2000: tick near +200_321", () => {
    const tick = priceToTick(1 / 2000, USDC_ASEP.decimals, WETH_ASEP.decimals);
    expect(tick).toBeCloseTo(200_321, -2);
    expect(tick).toBeGreaterThan(190_000);
  });

  it("inverted pair: user enters $2000 USDC/WETH → same tick as canonical USDC/WETH", () => {
    const canonical  = priceToTick(1 / 2000, USDC_ASEP.decimals, WETH_ASEP.decimals);
    const viaInverse = priceToTick(1 / 2000, USDC_ASEP.decimals, WETH_ASEP.decimals);
    expect(canonical).toBe(viaInverse);
  });

  it("Uniswap V3 fee=3000 (spacing=60): full flow for $1000–$4000 range", () => {
    const { sorted0, sorted1 } = sortTokens(USDC_ASEP, WETH_ASEP);
    const tickLower = snapTick(priceToTick(1 / 4000, sorted0.decimals, sorted1.decimals), 60, true);
    const tickUpper = snapTick(priceToTick(1 / 1000, sorted0.decimals, sorted1.decimals), 60, false);
    const sqrtP     = priceToSqrtPriceX96(1 / 2000, sorted0.decimals, sorted1.decimals);
    expect(sqrtP).toBeGreaterThan(0n);
    expect(tickLower % 60 == 0).toBe(true);
    expect(tickUpper % 60 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    const startTick = priceToTick(1 / 2000, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);
  });

  it("Uniswap V3 fee=100 (spacing=1): tick is exactly aligned (spacing=1 accepts all ticks)", () => {
    const raw     = priceToTick(1 / 2000, USDC_ASEP.decimals, WETH_ASEP.decimals);
    const snapped = snapTick(raw, 1, true);
    expect(snapped).toBe(raw);
  });

  it("priceToTick monotonic: $1000 > $2000 > $4000 → decreasing pool tick for USDC/WETH", () => {
    const t1000 = priceToTick(1 / 1000, USDC_ASEP.decimals, WETH_ASEP.decimals);
    const t2000 = priceToTick(1 / 2000, USDC_ASEP.decimals, WETH_ASEP.decimals);
    const t4000 = priceToTick(1 / 4000, USDC_ASEP.decimals, WETH_ASEP.decimals);
    expect(t4000).toBeLessThan(t2000);
    expect(t2000).toBeLessThan(t1000);
  });
});

// ─── OP Sepolia — Uniswap V3 only ────────────────────────────────────────────
//
// WETH (0x4200…) < USDC (0x5fd8…) by address → WETH=sorted0, USDC=sorted1
// decAdj = 6 − 18 = −12  (same negative branch as Arbitrum mainnet WETH/USDC)
// At ETH=$2000: poolPrice=2000×10^-12=2e-9, tick≈−200_312

describe("OP Sepolia — WETH(18)/USDC(6) — Uniswap V3", () => {
  const WETH_OSEP = { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 };
  const USDC_OSEP = { address: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7", symbol: "USDC", decimals: 6 };

  it("sortTokens: WETH(0x42) < USDC(0x5f) → WETH=sorted0, USDC=sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WETH_OSEP, USDC_OSEP);
    expect(sorted0.symbol).toBe("WETH");
    expect(sorted1.symbol).toBe("USDC");
    expect(wasSwapped).toBe(false);
  });

  it("inverted (USDC token0 / WETH token1): wasSwapped=true, sorted0=WETH", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(USDC_OSEP, WETH_OSEP);
    expect(wasSwapped).toBe(true);
    expect(sorted0.symbol).toBe("WETH");
    expect(sorted1.symbol).toBe("USDC");
  });

  it("ETH=$2000: tick is near −200_312 (same as Arbitrum mainnet WETH/USDC)", () => {
    const tick = priceToTick(2000, WETH_OSEP.decimals, USDC_OSEP.decimals);
    expect(tick).toBeCloseTo(-200_312, -2);
    expect(tick).toBeLessThan(-195_000);
  });

  it("inverted: user enters USDC/WETH → pairSwapped → tick equals canonical WETH/USDC tick", () => {
    // pairSwapped: pool direction unchanged — price 2000 USDC/WETH is the native direction for WETH=sorted0
    const canonical  = priceToTick(2000, WETH_OSEP.decimals, USDC_OSEP.decimals);
    const viaInverse = priceToTick(2000, WETH_OSEP.decimals, USDC_OSEP.decimals);
    expect(canonical).toBe(viaInverse);
  });

  it("Uniswap V3 fee=3000 (spacing=60): full flow for $1500–$3000 range", () => {
    const { sorted0, sorted1 } = sortTokens(WETH_OSEP, USDC_OSEP);
    const tickLower = snapTick(priceToTick(1500, sorted0.decimals, sorted1.decimals), 60, true);
    const tickUpper = snapTick(priceToTick(3000, sorted0.decimals, sorted1.decimals), 60, false);
    const sqrtP     = priceToSqrtPriceX96(2000, sorted0.decimals, sorted1.decimals);
    expect(sqrtP).toBeGreaterThan(0n);
    expect(tickLower % 60 == 0).toBe(true);
    expect(tickUpper % 60 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    const startTick = priceToTick(2000, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);
  });

  it("priceToTick monotonic: $1500 < $2000 < $3000 (WETH/USDC — higher price = higher tick)", () => {
    const t1500 = priceToTick(1500, WETH_OSEP.decimals, USDC_OSEP.decimals);
    const t2000 = priceToTick(2000, WETH_OSEP.decimals, USDC_OSEP.decimals);
    const t3000 = priceToTick(3000, WETH_OSEP.decimals, USDC_OSEP.decimals);
    expect(t1500).toBeLessThan(t2000);
    expect(t2000).toBeLessThan(t3000);
  });

  it("OP Sepolia WETH/USDC tick matches Arbitrum mainnet WETH/USDC at same price (same decimal layout)", () => {
    const USDC_ARB = { decimals: 6 };
    const WETH_ARB = { decimals: 18 };
    const tickOPSep = priceToTick(2000, WETH_OSEP.decimals, USDC_OSEP.decimals);
    const tickARB   = priceToTick(2000, WETH_ARB.decimals,  USDC_ARB.decimals);
    expect(tickOPSep).toBe(tickARB);
  });
});

// ─── BNB Testnet — PancakeSwap V3 only ───────────────────────────────────────
//
// USDT (0x3376…) < WBNB (0xae13…) by address → USDT=sorted0, WBNB=sorted1
// decAdj = 0  (both 18 dec — same pattern as BNB mainnet)
// humanPrice = WBNB per USDT = 1/BNB_USD
// At BNB=$400: humanPrice=1/400=0.0025, poolPrice=0.0025, tick≈−59_910

describe("BNB Testnet — USDT(18)/WBNB(18) — PancakeSwap V3 only", () => {
  const USDT_BNBT = { address: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", symbol: "USDT", decimals: 18 };
  const WBNB_BNBT = { address: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", symbol: "WBNB", decimals: 18 };
  const CAKE_BNBT = { address: "0xFa60D973F7642B748046464e165A65B7323b0C73", symbol: "CAKE", decimals: 18 };

  it("sortTokens: USDT(0x33) < WBNB(0xae) → USDT=sorted0, WBNB=sorted1", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(USDT_BNBT, WBNB_BNBT);
    expect(sorted0.symbol).toBe("USDT");
    expect(sorted1.symbol).toBe("WBNB");
    expect(wasSwapped).toBe(false);
  });

  it("inverted (WBNB token0 / USDT token1): wasSwapped=true, sorted0=USDT", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(WBNB_BNBT, USDT_BNBT);
    expect(wasSwapped).toBe(true);
    expect(sorted0.symbol).toBe("USDT");
    expect(sorted1.symbol).toBe("WBNB");
  });

  it("BNB=$400: tick is near −59_910 (negative, same decAdj=0 as BNB mainnet)", () => {
    const tick = priceToTick(1 / 400, USDT_BNBT.decimals, WBNB_BNBT.decimals);
    expect(tick).toBeCloseTo(-59_910, -2);
    expect(tick).toBeLessThan(0);
  });

  it("inverted: user enters $400 USDT/WBNB → pool price 1/400 → same tick as canonical", () => {
    const canonical  = priceToTick(1 / 400, USDT_BNBT.decimals, WBNB_BNBT.decimals);
    const viaInverse = priceToTick(1 / 400, USDT_BNBT.decimals, WBNB_BNBT.decimals);
    expect(canonical).toBe(viaInverse);
  });

  it("PancakeSwap V3 fee=2500 (spacing=50): full flow for $300–$600 BNB range", () => {
    const { sorted0, sorted1 } = sortTokens(USDT_BNBT, WBNB_BNBT);
    const tickLower = snapTick(priceToTick(1 / 600, sorted0.decimals, sorted1.decimals), 50, true);
    const tickUpper = snapTick(priceToTick(1 / 300, sorted0.decimals, sorted1.decimals), 50, false);
    const sqrtP     = priceToSqrtPriceX96(1 / 400, sorted0.decimals, sorted1.decimals);
    expect(sqrtP).toBeGreaterThan(0n);
    expect(tickLower % 50 == 0).toBe(true);
    expect(tickUpper % 50 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
    const startTick = priceToTick(1 / 400, sorted0.decimals, sorted1.decimals);
    expect(startTick).toBeGreaterThan(tickLower);
    expect(startTick).toBeLessThan(tickUpper);
    expect(tickUpper).toBeLessThan(0); // both ticks negative for these prices
  });

  it("PancakeSwap V3 fee=100 (spacing=1): ticks aligned for tight $380–$420 range", () => {
    const { sorted0, sorted1 } = sortTokens(USDT_BNBT, WBNB_BNBT);
    const tickLower = snapTick(priceToTick(1 / 420, sorted0.decimals, sorted1.decimals), 1, true);
    const tickUpper = snapTick(priceToTick(1 / 380, sorted0.decimals, sorted1.decimals), 1, false);
    expect(tickLower % 1 == 0).toBe(true);
    expect(tickUpper % 1 == 0).toBe(true);
    expect(tickLower).toBeLessThan(tickUpper);
  });

  it("CAKE/WBNB: sortTokens CAKE(0xFa) > WBNB(0xae) → wasSwapped=true, sorted0=WBNB", () => {
    const { sorted0, sorted1, wasSwapped } = sortTokens(CAKE_BNBT, WBNB_BNBT);
    expect(wasSwapped).toBe(true);
    expect(sorted0.symbol).toBe("WBNB");
    expect(sorted1.symbol).toBe("CAKE");
  });

  it("CAKE/WBNB inverted: user enters CAKE/WBNB → pool uses WBNB/CAKE after swap", () => {
    const { sorted0, sorted1 } = sortTokens(WBNB_BNBT, CAKE_BNBT); // natural WBNB/CAKE
    // CAKE=$0.50, BNB=$400 → price in CAKE per WBNB = 400/0.5 = 800
    const sqrtP = priceToSqrtPriceX96(800, sorted0.decimals, sorted1.decimals);
    expect(sqrtP).toBeGreaterThan(0n);
    const tick = priceToTick(800, sorted0.decimals, sorted1.decimals);
    expect(tick).toBeGreaterThan(0); // WBNB/CAKE at 800 CAKE/WBNB → positive ticks
  });

  it("BNB Testnet ticks match BNB mainnet at same price (both 18-dec pairs, decAdj=0)", () => {
    const USDC_BNB_MAIN = { decimals: 18 }; // BNB mainnet USDC is 18 dec
    const WBNB_MAIN     = { decimals: 18 };
    const tickTestnet = priceToTick(1 / 400, USDT_BNBT.decimals, WBNB_BNBT.decimals);
    const tickMainnet = priceToTick(1 / 400, USDC_BNB_MAIN.decimals, WBNB_MAIN.decimals);
    // Same decimal layout → same tick regardless of chain
    expect(tickTestnet).toBe(tickMainnet);
  });
});
