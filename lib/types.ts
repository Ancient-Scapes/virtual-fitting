export type BodySpec = {
  height: number;
  shoulder: number;
};

export type ClothSpec = {
  shoulder: number;
  length: number;
};

export type TryOnRequestPayload = {
  userImageB64: string;
  clothImageB64: string;
  body: BodySpec;
  cloth: ClothSpec;
};

export type RatingBreakdown = {
  shoulderScore: number;
  lengthScore: number;
  totalScore: number;
  shoulderDiff: number;
  lengthTarget: number;
  length: number;
};

export type TryOnFeedback = {
  stars: 1 | 2 | 3 | 4 | 5;
  comment: string;
  breakdown: RatingBreakdown;
};

export type StoredResult = {
  imageBase64: string;
  feedback: TryOnFeedback;
  body: BodySpec;
  cloth: ClothSpec;
  generatedAt: string;
};
