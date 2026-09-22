'use strict';

const express = require('express');
const { postDownload, getFile, getHealth } = require('../controllers/downloadController');
const { getReadiness } = require('../controllers/readinessController');
const { getMetrics } = require('../controllers/metricsController');
const { downloadLimiter } = require('../middleware/rateLimit');

const { postVideoInfo, postVideoDownload } = require('../controllers/videoController');

const router = express.Router();

router.get('/health', getHealth);
router.get('/ready', getReadiness);
router.get('/metrics', getMetrics);
router.post('/download', downloadLimiter(), postDownload);
router.post('/video/info', downloadLimiter(), postVideoInfo);
router.post('/video/download', downloadLimiter(), postVideoDownload);
router.get('/file/:id', getFile);

module.exports = router;
