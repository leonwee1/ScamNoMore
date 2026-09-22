import {
  angleForProbability,
  arcPath,
  polarToCartesian,
  RISK_BANDS,
} from '../components/RiskGauge';
import { riskFromProbability } from '../services/analysis';

describe('angleForProbability', () => {
  it('maps 0 to the far left (180 degrees)', () => {
    expect(angleForProbability(0)).toBe(180);
  });

  it('maps 1 to the far right (0 degrees)', () => {
    expect(angleForProbability(1)).toBe(0);
  });

  it('maps 0.5 to straight up (90 degrees)', () => {
    expect(angleForProbability(0.5)).toBe(90);
  });

  it('decreases monotonically as probability rises', () => {
    const angles = [0, 0.25, 0.5, 0.75, 1].map(angleForProbability);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]).toBeLessThan(angles[i - 1]);
    }
  });

  it('clamps out-of-range input', () => {
    expect(angleForProbability(-1)).toBe(180);
    expect(angleForProbability(5)).toBe(0);
  });
});

describe('polarToCartesian', () => {
  const cx = 100;
  const cy = 100;
  const r = 50;

  it('places 0 degrees to the right of centre', () => {
    const p = polarToCartesian(cx, cy, r, 0);
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(100);
  });

  it('places 90 degrees above centre (smaller y in SVG space)', () => {
    const p = polarToCartesian(cx, cy, r, 90);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });

  it('places 180 degrees to the left of centre', () => {
    const p = polarToCartesian(cx, cy, r, 180);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(100);
  });

  it('keeps every point on the radius', () => {
    for (const angle of [0, 30, 45, 90, 135, 180]) {
      const p = polarToCartesian(cx, cy, r, angle);
      const dist = Math.hypot(p.x - cx, cy - p.y);
      expect(dist).toBeCloseTo(r);
    }
  });
});

describe('arcPath', () => {
  it('produces a clockwise (sweep=1) arc command', () => {
    const d = arcPath(100, 100, 50, 180, 0);
    expect(d).toMatch(/^M /);
    expect(d).toContain('A 50 50 0 0 1');
  });

  it('starts at the start angle and ends at the end angle', () => {
    const d = arcPath(100, 100, 50, 180, 90);
    // Starts far-left (50,100), ends top-centre (100,50).
    expect(d).toContain('M 50 100');
    expect(d).toContain('100 50');
  });
});

describe('RISK_BANDS', () => {
  it('covers 0..1 with no gaps', () => {
    expect(RISK_BANDS[0].from).toBe(0);
    expect(RISK_BANDS[RISK_BANDS.length - 1].to).toBe(1);
    for (let i = 1; i < RISK_BANDS.length; i++) {
      expect(RISK_BANDS[i].from).toBe(RISK_BANDS[i - 1].to);
    }
  });

  it('band boundaries agree with riskFromProbability', () => {
    for (const band of RISK_BANDS) {
      // Sample just inside the band; it must classify as that band's level.
      const mid = (band.from + band.to) / 2;
      expect(riskFromProbability(mid)).toBe(band.level);
    }
  });
});
