// Attorney profile
export interface Attorney {
  id: string;
  slug: string;
  name: string;
  firmName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  stateCode: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  practiceAreas: string[];
  yearsExperience: number | null;
}

// Review intelligence — 8-dimension analysis
export interface ReviewIntelligence {
  attorneyId: string;
  communication: number;    // 0-100
  outcome: number;          // 0-100
  responsiveness: number;   // 0-100
  empathy: number;          // 0-100
  expertise: number;        // 0-100
  feeTransparency: number;  // 0-100
  trialExperience: number;  // 0-100
  satisfaction: number;     // 0-100
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  reviewCount: number;
  bestQuotes: ReviewQuote[];
}

export interface ReviewQuote {
  text: string;
  dimension: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  rating: number;
}

// Attorney Index — 0-100 composite score
export interface AttorneyIndexScore {
  attorneyId: string;
  score: number; // 0-100 composite
  components: {
    communication: { score: number; weight: 0.25 };
    responsiveness: { score: number; weight: 0.20 };
    outcome: { score: number; weight: 0.30 };
    reviewCount: { score: number; weight: 0.15 };
    specialty: { score: number; weight: 0.10 };
  };
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW';
  reviewCount: number;
}
