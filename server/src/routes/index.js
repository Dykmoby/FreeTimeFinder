import { Router } from 'express';
import authRoutes from './auth.routes.js';
import profileRoutes from './profile.routes.js';
import availabilityRoutes from './availability.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/availability', availabilityRoutes);
router.use('/admin', adminRoutes);

export default router;
