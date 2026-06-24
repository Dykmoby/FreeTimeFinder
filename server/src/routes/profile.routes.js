import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import {
  updateMyProfile,
  updateMyAvatar,
  removeMyAvatar,
} from '../controllers/profile.controller.js';

const router = Router();

router.use(requireAuth);
router.patch('/', updateMyProfile);
router.post('/avatar', uploadAvatar, updateMyAvatar);
router.delete('/avatar', removeMyAvatar);

export default router;
