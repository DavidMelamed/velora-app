import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { errorHandler } from './middleware/error-handler'
import { readLimiter, writeLimiter, authLimiter } from './middleware/rate-limit'
import healthRoutes from './routes/health'
import crashRoutes from './routes/crashes'
import equalizerRoutes from './routes/equalizer'
import attorneyRoutes from './routes/attorneys'
import searchRoutes from './routes/search'
import feedbackRoutes from './routes/feedback'
import pipelineRoutes from './routes/pipeline'
import learningMetricsRoutes from './routes/admin/learning-metrics'

const app = express()
const PORT = process.env.PORT || 4000

// Trust proxy (Railway, Vercel, etc.)
app.set('trust proxy', 1)

// Middleware
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'] }))
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/health', healthRoutes)
app.use('/api/crashes', readLimiter, crashRoutes)
app.use('/api/equalizer', readLimiter, equalizerRoutes)
app.use('/api/attorneys', readLimiter, attorneyRoutes)
app.use('/api/search', readLimiter, searchRoutes)
app.use('/api/feedback', writeLimiter, feedbackRoutes)
app.use('/api/pipeline', authLimiter, pipelineRoutes)
app.use('/api/admin/learning', authLimiter, learningMetricsRoutes)

// Error handler (must be last)
app.use(errorHandler)

app.listen(PORT, () => console.log(`Velora API listening on port ${PORT}`))

export { app }
