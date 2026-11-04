import { angularSpread, sphericalCentroid } from "@/lib/atlas/camera";

describe("sphericalCentroid", () => {
  it("returns the point itself for one place", () => {
    const [lng, lat] = sphericalCentroid([[-9.14, 38.72]])!;
    expect(lng).toBeCloseTo(-9.14, 6);
    expect(lat).toBeCloseTo(38.72, 6);
  });

  it("crosses the antimeridian correctly", () => {
    // Fiji (178°E) and Samoa (172°W) sit either side of 180°: their midpoint is in the Pacific.
    const [lng] = sphericalCentroid([
      [178.4, -18.1],
      [-171.8, -13.8],
    ])!;
    expect(Math.abs(lng)).toBeGreaterThan(170);
  });

  it("has no answer for no points or exactly opposite points", () => {
    expect(sphericalCentroid([])).toBeNull();
    expect(
      sphericalCentroid([
        [0, 0],
        [180, 0],
      ]),
    ).toBeNull();
  });
});

describe("angularSpread", () => {
  it("is small for one region and large for several continents", () => {
    const iberia: [number, number][] = [
      [-9.14, 38.72],
      [-3.7, 40.42],
    ];
    expect(angularSpread(iberia, sphericalCentroid(iberia)!)).toBeLessThan(10);
    const world: [number, number][] = [
      [-99.13, 19.43],
      [-9.14, 38.72],
      [135.77, 35.01],
    ];
    expect(angularSpread(world, sphericalCentroid(world)!)).toBeGreaterThan(40);
  });
});
