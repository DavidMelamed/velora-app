import { describe, it, expect } from 'vitest'
import {
  computeAttorneyIndex,
  computeReviewCountScore,
  computeSpecialtyScore,
  getDataQualityTier,
} from '../services/attorney-index'
import { detectTrend } from '../services/review-trend'
import type { ReviewIntelligenceData } from '../services/review-intelligence'

describe('Attorney Index', () => {
  describe('computeAttorneyIndex', () => {
    it('should compute correct weighted score', () => {
      const intelligence: ReviewIntelligenceData = {
        dimensions: {
          communication: 80,
          outcome: 90,
          responsiveness: 70,
          empathy: 60,
          expertise: 85,
          feeTransparency: 75,
          trialExperience: 65,
          satisfaction: 80,
        },
        trend: 'STABLE',
        reviewCount: 40,
        bestQuotes: [],
      }

      const result = computeAttorneyIndex(intelligence, ['personal_injury', 'car_accident'])

      // communication: 80 * 0.25 = 20
      // responsiveness: 70 * 0.20 = 14
      // outcome: 90 * 0.30 = 27
      // reviewCount: min(100, 40*3)=100 * 0.15 = 15
      // specialty: min(100, 2*25)=50 * 0.10 = 5
      // Total = 81
      expect(result.score).toBe(81)
      expect(result.components.communication).toBe(80)
      expect(result.components.responsiveness).toBe(70)
      expect(result.components.outcome).toBe(90)
      expect(result.components.reviewCount).toBe(100)
      expect(result.components.specialty).toBe(50)
    })

    it('should handle zero reviews', () => {
      const intelligence: ReviewIntelligenceData = {
        dimensions: {
          communication: 0,
          outcome: 0,
          responsiveness: 0,
          empathy: 0,
          expertise: 0,
          feeTransparency: 0,
          trialExperience: 0,
          satisfaction: 0,
        },
        trend: 'STABLE',
        reviewCount: 0,
        bestQuotes: [],
      }

      const result = computeAttorneyIndex(intelligence, [])
      expect(result.score).toBe(0)
      expect(result.dataQuality).toBe('LOW')
    })

    it('should cap score at 100', () => {
      const intelligence: ReviewIntelligenceData = {
        dimensions: {
          communication: 100,
          outcome: 100,
          responsiveness: 100,
          empathy: 100,
          expertise: 100,
          feeTransparency: 100,
          trialExperience: 100,
          satisfaction: 100,
        },
        trend: 'IMPROVING',
        reviewCount: 100,
        bestQuotes: [],
      }

      const result = computeAttorneyIndex(intelligence, [
        'personal_injury',
        'car_accident',
        'truck_accident',
        'motorcycle_accident',
        'pedestrian_accident',
      ])
      expect(result.score).toBe(100)
    })
  })

  describe('computeReviewCountScore', () => {
    it('should return 0 for 0 reviews', () => {
      expect(computeReviewCountScore(0)).toBe(0)
    })

    it('should return 30 for 10 reviews', () => {
      expect(computeReviewCountScore(10)).toBe(30)
    })

    it('should return 99 for 33 reviews', () => {
      expect(computeReviewCountScore(33)).toBe(99)
    })

    it('should cap at 100 for 34+ reviews', () => {
      expect(computeReviewCountScore(34)).toBe(100)
      expect(computeReviewCountScore(100)).toBe(100)
    })
  })

  describe('computeSpecialtyScore', () => {
    it('should return 0 for no matching areas', () => {
      expect(computeSpecialtyScore(['bankruptcy', 'family_law'])).toBe(0)
    })

    it('should score 25 per match', () => {
      expect(computeSpecialtyScore(['personal_injury'])).toBe(25)
      expect(computeSpecialtyScore(['personal_injury', 'car_accident'])).toBe(50)
    })

    it('should cap at 100', () => {
      expect(
        computeSpecialtyScore([
          'personal_injury',
          'car_accident',
          'truck_accident',
          'motorcycle_accident',
          'pedestrian_accident',
        ])
      ).toBe(100)
    })

    it('should normalize area names with spaces and hyphens', () => {
      expect(computeSpecialtyScore(['Personal Injury', 'Car-Accident'])).toBe(50)
    })
  })

  describe('getDataQualityTier', () => {
    it('should return LOW for <10 reviews', () => {
      expect(getDataQualityTier(0)).toBe('LOW')
      expect(getDataQualityTier(9)).toBe('LOW')
    })

    it('should return MEDIUM for 10-29 reviews', () => {
      expect(getDataQualityTier(10)).toBe('MEDIUM')
      expect(getDataQualityTier(29)).toBe('MEDIUM')
    })

    it('should return HIGH for 30+ reviews', () => {
      expect(getDataQualityTier(30)).toBe('HIGH')
      expect(getDataQualityTier(100)).toBe('HIGH')
    })
  })

  describe('detectTrend', () => {
    it('should return STABLE for <4 reviews', () => {
      const reviews = [
        { id: '1', text: 'Great', rating: 5, publishedAt: new Date(), authorName: 'A' },
        { id: '2', text: 'Good', rating: 4, publishedAt: new Date(), authorName: 'B' },
      ]
      expect(detectTrend(reviews)).toBe('STABLE')
    })

    it('should detect IMPROVING trend', () => {
      const now = new Date()
      const reviews = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        text: 'Review',
        rating: i < 5 ? 3 : 5, // older half: 3 avg, recent half: 5 avg
        publishedAt: new Date(now.getTime() - (10 - i) * 24 * 60 * 60 * 1000),
        authorName: `Author ${i}`,
      }))
      expect(detectTrend(reviews)).toBe('IMPROVING')
    })

    it('should detect DECLINING trend', () => {
      const now = new Date()
      const reviews = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        text: 'Review',
        rating: i < 5 ? 5 : 2, // older half: 5 avg, recent half: 2 avg
        publishedAt: new Date(now.getTime() - (10 - i) * 24 * 60 * 60 * 1000),
        authorName: `Author ${i}`,
      }))
      expect(detectTrend(reviews)).toBe('DECLINING')
    })

    it('should detect STABLE trend for similar ratings', () => {
      const now = new Date()
      const reviews = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        text: 'Review',
        rating: 4,
        publishedAt: new Date(now.getTime() - (10 - i) * 24 * 60 * 60 * 1000),
        authorName: `Author ${i}`,
      }))
      expect(detectTrend(reviews)).toBe('STABLE')
    })
  })
})
