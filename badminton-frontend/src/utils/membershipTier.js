const MEMBERSHIP_TIERS = [
  {
    code: "Vang",
    label: "Vàng",
    minPoints: 3000,
    nextTarget: null,
    nextLabel: null,
    hourlyDiscount: 5000,
  },
  {
    code: "Bac",
    label: "Bạc",
    minPoints: 1000,
    nextTarget: 3000,
    nextLabel: "Vàng",
    hourlyDiscount: 2000,
  },
  {
    code: "Dong",
    label: "Đồng",
    minPoints: 0,
    nextTarget: 1000,
    nextLabel: "Bạc",
    hourlyDiscount: 0,
  },
];

export const getMembershipTier = (value) => {
  const parsedPoints = Number(value);
  const points = Number.isFinite(parsedPoints) ? Math.max(0, parsedPoints) : 0;
  const tier =
    MEMBERSHIP_TIERS.find((item) => points >= item.minPoints) ||
    MEMBERSHIP_TIERS[MEMBERSHIP_TIERS.length - 1];

  const progress = tier.nextTarget
    ? Math.min(
        100,
        Math.round(
          ((points - tier.minPoints) / (tier.nextTarget - tier.minPoints)) *
            100,
        ),
      )
    : 100;

  return {
    ...tier,
    points,
    progress,
    pointsToNext: tier.nextTarget ? Math.max(0, tier.nextTarget - points) : 0,
  };
};
