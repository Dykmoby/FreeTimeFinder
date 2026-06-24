import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listMine,
  createMine,
  updateMine,
  deleteMine,
  replaceMyDay,
  listEveryone,
  listUsers,
} from '../controllers/availability.controller.js';

const router = Router();

router.use(requireAuth);

// My own free time
router.get('/mine', listMine);
router.post('/mine', createMine);
router.put('/mine/day', replaceMyDay);
router.patch('/mine/:id', updateMine);
router.delete('/mine/:id', deleteMine);

// Everyone's free time (read-only overview + intersection source)
router.get('/everyone', listEveryone);

// People list (for the editor's per-interval visibility picker)
router.get('/users', listUsers);

export default router;
