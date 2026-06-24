import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  listUserAvailability,
  createUserInterval,
  replaceUserDay,
  updateInterval,
  deleteInterval,
} from '../controllers/admin.controller.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// User management
router.get('/users', listUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.post('/users/:id/password', resetUserPassword);
router.delete('/users/:id', deleteUser);

// Editing any user's free-time records
router.get('/users/:id/availability', listUserAvailability);
router.post('/users/:id/availability', createUserInterval);
router.put('/users/:id/availability/day', replaceUserDay);
router.patch('/availability/:intervalId', updateInterval);
router.delete('/availability/:intervalId', deleteInterval);

export default router;
