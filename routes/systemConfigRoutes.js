import express from 'express';
import {
    getSystemConfigs,
    getConfigByKey,
    upsertConfig,
    deleteConfig,
    getFeatureFlags,
    initializeDefaultConfigs,
} from '../controllers/systemConfigController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, admin, getSystemConfigs);
router.get('/feature-flags', protect, admin, getFeatureFlags);
router.post('/initialize', protect, admin, initializeDefaultConfigs);
router.get('/:key', protect, admin, getConfigByKey);
router.put('/:key', protect, admin, upsertConfig);
router.delete('/:key', protect, admin, deleteConfig);

export default router;
