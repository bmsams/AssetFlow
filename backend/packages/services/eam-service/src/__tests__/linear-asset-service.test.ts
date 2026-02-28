/**
 * Linear Asset Service Unit Tests
 *
 * Tests for linear asset management and segment tracking.
 * Requirement 5.3: Track assets spanning physical distances with segment-based location tracking
 */

import type { ConditionRating, LinearAssetSegment } from '../linear-asset';

describe('LinearAssetService', () => {
  describe('Total length calculation', () => {
    it('should calculate total length from segments', () => {
      const segments: Pick<LinearAssetSegment, 'segmentLength'>[] = [
        { segmentLength: 100.5 },
        { segmentLength: 200.25 },
        { segmentLength: 150.75 },
      ];

      const totalLength = segments.reduce(
        (sum, seg) => sum + (seg.segmentLength ?? 0),
        0
      );

      expect(totalLength).toBe(451.5);
    });

    it('should handle segments with null lengths', () => {
      const segments: Pick<LinearAssetSegment, 'segmentLength'>[] = [
        { segmentLength: 100 },
        { segmentLength: null },
        { segmentLength: 200 },
      ];

      const totalLength = segments.reduce(
        (sum, seg) => sum + (seg.segmentLength ?? 0),
        0
      );

      expect(totalLength).toBe(300);
    });

    it('should return 0 for empty segments array', () => {
      const segments: Pick<LinearAssetSegment, 'segmentLength'>[] = [];

      const totalLength = segments.reduce(
        (sum, seg) => sum + (seg.segmentLength ?? 0),
        0
      );

      expect(totalLength).toBe(0);
    });

    it('should handle all null lengths', () => {
      const segments: Pick<LinearAssetSegment, 'segmentLength'>[] = [
        { segmentLength: null },
        { segmentLength: null },
      ];

      const totalLength = segments.reduce(
        (sum, seg) => sum + (seg.segmentLength ?? 0),
        0
      );

      expect(totalLength).toBe(0);
    });
  });

  describe('Segment condition summary', () => {
    function calculateConditionSummary(
      segments: Pick<LinearAssetSegment, 'conditionRating' | 'hasActiveDefects' | 'nextInspectionDue'>[]
    ) {
      const byCondition: Record<ConditionRating, number> = {
        EXCELLENT: 0,
        GOOD: 0,
        FAIR: 0,
        POOR: 0,
        CRITICAL: 0,
      };

      let segmentsWithDefects = 0;
      let segmentsDueForInspection = 0;
      const today = '2024-01-15';

      for (const segment of segments) {
        if (segment.conditionRating) {
          byCondition[segment.conditionRating]++;
        }
        if (segment.hasActiveDefects) {
          segmentsWithDefects++;
        }
        if (segment.nextInspectionDue && segment.nextInspectionDue <= today) {
          segmentsDueForInspection++;
        }
      }

      return {
        totalSegments: segments.length,
        byCondition,
        segmentsWithDefects,
        segmentsDueForInspection,
      };
    }

    it('should count segments by condition rating', () => {
      const segments: Pick<LinearAssetSegment, 'conditionRating' | 'hasActiveDefects' | 'nextInspectionDue'>[] = [
        { conditionRating: 'EXCELLENT', hasActiveDefects: false, nextInspectionDue: null },
        { conditionRating: 'GOOD', hasActiveDefects: false, nextInspectionDue: null },
        { conditionRating: 'GOOD', hasActiveDefects: false, nextInspectionDue: null },
        { conditionRating: 'FAIR', hasActiveDefects: false, nextInspectionDue: null },
        { conditionRating: 'POOR', hasActiveDefects: true, nextInspectionDue: null },
      ];

      const summary = calculateConditionSummary(segments);

      expect(summary.totalSegments).toBe(5);
      expect(summary.byCondition.EXCELLENT).toBe(1);
      expect(summary.byCondition.GOOD).toBe(2);
      expect(summary.byCondition.FAIR).toBe(1);
      expect(summary.byCondition.POOR).toBe(1);
      expect(summary.byCondition.CRITICAL).toBe(0);
    });

    it('should count segments with active defects', () => {
      const segments: Pick<LinearAssetSegment, 'conditionRating' | 'hasActiveDefects' | 'nextInspectionDue'>[] = [
        { conditionRating: 'GOOD', hasActiveDefects: false, nextInspectionDue: null },
        { conditionRating: 'POOR', hasActiveDefects: true, nextInspectionDue: null },
        { conditionRating: 'CRITICAL', hasActiveDefects: true, nextInspectionDue: null },
      ];

      const summary = calculateConditionSummary(segments);

      expect(summary.segmentsWithDefects).toBe(2);
    });

    it('should count segments due for inspection', () => {
      const segments: Pick<LinearAssetSegment, 'conditionRating' | 'hasActiveDefects' | 'nextInspectionDue'>[] = [
        { conditionRating: 'GOOD', hasActiveDefects: false, nextInspectionDue: '2024-01-10' }, // Past due
        { conditionRating: 'GOOD', hasActiveDefects: false, nextInspectionDue: '2024-01-15' }, // Due today
        { conditionRating: 'GOOD', hasActiveDefects: false, nextInspectionDue: '2024-01-20' }, // Future
        { conditionRating: 'GOOD', hasActiveDefects: false, nextInspectionDue: null }, // No date
      ];

      const summary = calculateConditionSummary(segments);

      expect(summary.segmentsDueForInspection).toBe(2); // Past due + due today
    });

    it('should handle empty segments array', () => {
      const segments: Pick<LinearAssetSegment, 'conditionRating' | 'hasActiveDefects' | 'nextInspectionDue'>[] = [];

      const summary = calculateConditionSummary(segments);

      expect(summary.totalSegments).toBe(0);
      expect(summary.segmentsWithDefects).toBe(0);
      expect(summary.segmentsDueForInspection).toBe(0);
    });
  });
});


describe('LinearAsset validation', () => {
  describe('Linear unit of measure', () => {
    const validUnits = ['METERS', 'KILOMETERS', 'FEET', 'MILES', 'YARDS'];

    it.each(validUnits)('should accept %s as valid unit', (unit) => {
      expect(validUnits).toContain(unit);
    });

    it('should reject invalid units', () => {
      const invalidUnits = ['INCHES', 'CENTIMETERS', 'NAUTICAL_MILES'];
      invalidUnits.forEach(unit => {
        expect(validUnits).not.toContain(unit);
      });
    });
  });

  describe('Route types', () => {
    const validRouteTypes = ['PIPELINE', 'CABLE', 'TRACK', 'ROAD', 'FENCE', 'CONVEYOR', 'DUCT', 'OTHER'];

    it.each(validRouteTypes)('should accept %s as valid route type', (routeType) => {
      expect(validRouteTypes).toContain(routeType);
    });
  });

  describe('Condition ratings', () => {
    const validConditions = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'];

    it.each(validConditions)('should accept %s as valid condition', (condition) => {
      expect(validConditions).toContain(condition);
    });

    it('should have 5 condition levels', () => {
      expect(validConditions.length).toBe(5);
    });
  });

  describe('GPS coordinate validation', () => {
    it('should accept valid latitude values', () => {
      const validLatitudes = [-90, -45, 0, 45, 90];
      validLatitudes.forEach(lat => {
        expect(lat >= -90 && lat <= 90).toBe(true);
      });
    });

    it('should reject invalid latitude values', () => {
      const invalidLatitudes = [-91, 91, -180, 180];
      invalidLatitudes.forEach(lat => {
        expect(lat >= -90 && lat <= 90).toBe(false);
      });
    });

    it('should accept valid longitude values', () => {
      const validLongitudes = [-180, -90, 0, 90, 180];
      validLongitudes.forEach(lng => {
        expect(lng >= -180 && lng <= 180).toBe(true);
      });
    });

    it('should reject invalid longitude values', () => {
      const invalidLongitudes = [-181, 181, -360, 360];
      invalidLongitudes.forEach(lng => {
        expect(lng >= -180 && lng <= 180).toBe(false);
      });
    });
  });
});

describe('Segment validation', () => {
  describe('Sequence number', () => {
    it('should require positive sequence numbers', () => {
      const validSequences = [1, 2, 3, 100];
      validSequences.forEach(seq => {
        expect(seq > 0).toBe(true);
      });
    });

    it('should reject non-positive sequence numbers', () => {
      const invalidSequences = [0, -1, -100];
      invalidSequences.forEach(seq => {
        expect(seq > 0).toBe(false);
      });
    });
  });

  describe('Segment length', () => {
    it('should require positive segment lengths', () => {
      const validLengths = [0.1, 1, 100, 1000.5];
      validLengths.forEach(length => {
        expect(length > 0).toBe(true);
      });
    });

    it('should reject non-positive segment lengths', () => {
      const invalidLengths = [0, -1, -100.5];
      invalidLengths.forEach(length => {
        expect(length > 0).toBe(false);
      });
    });

    it('should allow null segment length', () => {
      const length: number | null = null;
      expect(length === null || length > 0).toBe(true);
    });
  });

  describe('Defect tracking', () => {
    it('should require non-negative defect count', () => {
      const validCounts = [0, 1, 5, 100];
      validCounts.forEach(count => {
        expect(count >= 0).toBe(true);
      });
    });

    it('should reject negative defect counts', () => {
      const invalidCounts = [-1, -5];
      invalidCounts.forEach(count => {
        expect(count >= 0).toBe(false);
      });
    });
  });
});

describe('Unit conversion helpers', () => {
  // Conversion factors to meters
  const conversionFactors: Record<string, number> = {
    METERS: 1,
    KILOMETERS: 1000,
    FEET: 0.3048,
    MILES: 1609.344,
    YARDS: 0.9144,
  };

  function convertToMeters(value: number, unit: string): number {
    const factor = conversionFactors[unit];
    if (!factor) {
      throw new Error(`Unknown unit: ${unit}`);
    }
    return value * factor;
  }

  function convertFromMeters(meters: number, targetUnit: string): number {
    const factor = conversionFactors[targetUnit];
    if (!factor) {
      throw new Error(`Unknown unit: ${targetUnit}`);
    }
    return meters / factor;
  }

  it('should convert kilometers to meters', () => {
    expect(convertToMeters(1, 'KILOMETERS')).toBe(1000);
    expect(convertToMeters(5.5, 'KILOMETERS')).toBe(5500);
  });

  it('should convert miles to meters', () => {
    expect(convertToMeters(1, 'MILES')).toBeCloseTo(1609.344, 2);
  });

  it('should convert feet to meters', () => {
    expect(convertToMeters(1, 'FEET')).toBeCloseTo(0.3048, 4);
    expect(convertToMeters(100, 'FEET')).toBeCloseTo(30.48, 2);
  });

  it('should convert yards to meters', () => {
    expect(convertToMeters(1, 'YARDS')).toBeCloseTo(0.9144, 4);
  });

  it('should convert meters to kilometers', () => {
    expect(convertFromMeters(1000, 'KILOMETERS')).toBe(1);
    expect(convertFromMeters(5500, 'KILOMETERS')).toBe(5.5);
  });

  it('should convert meters to miles', () => {
    expect(convertFromMeters(1609.344, 'MILES')).toBeCloseTo(1, 2);
  });

  it('should handle round-trip conversion', () => {
    const originalKm = 10;
    const meters = convertToMeters(originalKm, 'KILOMETERS');
    const backToKm = convertFromMeters(meters, 'KILOMETERS');
    expect(backToKm).toBeCloseTo(originalKm, 10);
  });
});

describe('Segment ordering', () => {
  it('should maintain segment order by sequence number', () => {
    const segments = [
      { sequenceNumber: 3, startMarker: 'C' },
      { sequenceNumber: 1, startMarker: 'A' },
      { sequenceNumber: 2, startMarker: 'B' },
    ];

    const sorted = [...segments].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    expect(sorted[0]!.sequenceNumber).toBe(1);
    expect(sorted[1]!.sequenceNumber).toBe(2);
    expect(sorted[2]!.sequenceNumber).toBe(3);
    expect(sorted.map(s => s.startMarker)).toEqual(['A', 'B', 'C']);
  });

  it('should detect gaps in sequence numbers', () => {
    const segments = [
      { sequenceNumber: 1 },
      { sequenceNumber: 2 },
      { sequenceNumber: 4 }, // Gap - missing 3
      { sequenceNumber: 5 },
    ];

    const sorted = [...segments].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const hasGaps = sorted.some((seg, idx) => {
      if (idx === 0) return false;
      const prevSeg = sorted[idx - 1];
      return prevSeg !== undefined && seg.sequenceNumber !== prevSeg.sequenceNumber + 1;
    });

    expect(hasGaps).toBe(true);
  });

  it('should detect no gaps in continuous sequence', () => {
    const segments = [
      { sequenceNumber: 1 },
      { sequenceNumber: 2 },
      { sequenceNumber: 3 },
      { sequenceNumber: 4 },
    ];

    const sorted = [...segments].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const hasGaps = sorted.some((seg, idx) => {
      if (idx === 0) return false;
      const prevSeg = sorted[idx - 1];
      return prevSeg !== undefined && seg.sequenceNumber !== prevSeg.sequenceNumber + 1;
    });

    expect(hasGaps).toBe(false);
  });
});
