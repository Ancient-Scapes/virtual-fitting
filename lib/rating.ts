import { BodySpec, ClothSpec, RatingBreakdown, TryOnFeedback } from "./types";

const SHOULDER_WEIGHT = 50;
const LENGTH_WEIGHT = 50;
const IDEAL_LENGTH_TOLERANCE = 0.05; // ±5%

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function evaluateFit(body: BodySpec, cloth: ClothSpec): TryOnFeedback {
  const shoulderDiff = cloth.shoulder - body.shoulder; // + means roomy
  const lengthTarget = body.height * 0.25;
  const lengthDiff = Math.abs(cloth.length - lengthTarget);
  const lengthDeviationRatio = lengthDiff / lengthTarget;

  const shoulderScore = clampScore(
    SHOULDER_WEIGHT - Math.abs(shoulderDiff) * (SHOULDER_WEIGHT / 6)
  );

  const lengthScore = clampScore(
    LENGTH_WEIGHT - (lengthDeviationRatio / IDEAL_LENGTH_TOLERANCE) * (LENGTH_WEIGHT / 3)
  );

  const totalScore = clampScore(shoulderScore + lengthScore);

  let stars: TryOnFeedback["stars"] = 1;
  if (totalScore >= 85) stars = 5;
  else if (totalScore >= 70) stars = 4;
  else if (totalScore >= 55) stars = 3;
  else if (totalScore >= 40) stars = 2;

  const comments: string[] = [];
  if (shoulderDiff < -1) {
    comments.push("肩幅が小さくタイト傾向です");
  } else if (shoulderDiff > 4) {
    comments.push("肩が落ちる可能性があります");
  }

  const lengthDeviationPercent = lengthDeviationRatio * 100;
  if (lengthDeviationPercent > 10) {
    const direction = cloth.length > lengthTarget ? "長め" : "短め";
    comments.push(`着丈が${direction}です（理想比 ${lengthDeviationPercent.toFixed(1)}% 差）`);
  }

  if (comments.length === 0) {
    comments.push("サイズバランスは概ね良好です");
  }

  const breakdown: RatingBreakdown = {
    shoulderScore,
    lengthScore,
    totalScore,
    shoulderDiff,
    lengthTarget,
    length: cloth.length,
  };

  return {
    stars,
    comment: comments.join(" / "),
    breakdown,
  };
}
