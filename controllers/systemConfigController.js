import SystemConfig from '../models/SystemConfig.js';

// @desc    Get all system configurations
// @route   GET /api/system-config
// @access  Private/Admin
const getSystemConfigs = async (req, res) => {
    try {
        const { category } = req.query;

        const query = category ? { category } : {};
        const configs = await SystemConfig.find(query).sort({ category: 1, key: 1 });

        res.json(configs);
    } catch (error) {
        console.error('Error fetching system configs:', error);
        res.status(500).json({ message: 'Error fetching system configs', error: error.message });
    }
};

// @desc    Get a specific configuration by key
// @route   GET /api/system-config/:key
// @access  Private/Admin
const getConfigByKey = async (req, res) => {
    try {
        const { key } = req.params;

        const config = await SystemConfig.findOne({ key });

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        res.json(config);
    } catch (error) {
        console.error('Error fetching config:', error);
        res.status(500).json({ message: 'Error fetching config', error: error.message });
    }
};

// @desc    Create or update a configuration
// @route   PUT /api/system-config/:key
// @access  Private/Admin
const upsertConfig = async (req, res) => {
    try {
        const { key } = req.params;
        const { value, category, description, dataType, isPublic } = req.body;

        const config = await SystemConfig.findOneAndUpdate(
            { key },
            {
                key,
                value,
                category,
                description,
                dataType,
                isPublic,
                updatedBy: req.user._id,
            },
            { new: true, upsert: true }
        );

        res.json(config);
    } catch (error) {
        console.error('Error upserting config:', error);
        res.status(500).json({ message: 'Error upserting config', error: error.message });
    }
};

// @desc    Delete a configuration
// @route   DELETE /api/system-config/:key
// @access  Private/Admin
const deleteConfig = async (req, res) => {
    try {
        const { key } = req.params;

        const config = await SystemConfig.findOneAndDelete({ key });

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        res.json({ message: 'Configuration deleted successfully' });
    } catch (error) {
        console.error('Error deleting config:', error);
        res.status(500).json({ message: 'Error deleting config', error: error.message });
    }
};

// @desc    Get feature flags
// @route   GET /api/system-config/feature-flags
// @access  Private/Admin
const getFeatureFlags = async (req, res) => {
    try {
        const flags = await SystemConfig.find({ category: 'FEATURE_FLAGS' });
        res.json(flags);
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        res.status(500).json({ message: 'Error fetching feature flags', error: error.message });
    }
};

// @desc    Initialize default system configurations
// @route   POST /api/system-config/initialize
// @access  Private/Admin
const initializeDefaultConfigs = async (req, res) => {
    try {
        const defaultConfigs = [
            {
                key: 'FEATURE_LEAVE_REQUESTS',
                value: true,
                category: 'FEATURE_FLAGS',
                description: 'Enable/disable leave request functionality',
                dataType: 'boolean',
                isPublic: false,
            },
            {
                key: 'FEATURE_EXCUSE_REQUESTS',
                value: true,
                category: 'FEATURE_FLAGS',
                description: 'Enable/disable excuse request functionality',
                dataType: 'boolean',
                isPublic: false,
            },
            {
                key: 'FEATURE_LETTER_REQUESTS',
                value: true,
                category: 'FEATURE_FLAGS',
                description: 'Enable/disable letter request functionality',
                dataType: 'boolean',
                isPublic: false,
            },
            {
                key: 'MAX_LOGIN_ATTEMPTS',
                value: 5,
                category: 'SECURITY',
                description: 'Maximum failed login attempts before account lock',
                dataType: 'number',
                isPublic: false,
            },
            {
                key: 'SESSION_TIMEOUT_HOURS',
                value: 24,
                category: 'SECURITY',
                description: 'Session timeout in hours',
                dataType: 'number',
                isPublic: false,
            },
            {
                key: 'MAX_FILE_UPLOAD_SIZE_MB',
                value: 10,
                category: 'SYSTEM_SETTINGS',
                description: 'Maximum file upload size in MB',
                dataType: 'number',
                isPublic: false,
            },
            {
                key: 'DEFAULT_PASSWORD',
                value: 'password123',
                category: 'SYSTEM_SETTINGS',
                description: 'Default password for password resets',
                dataType: 'string',
                isPublic: false,
            },
            {
                key: 'EMAIL_NOTIFICATIONS_ENABLED',
                value: true,
                category: 'EMAIL_SETTINGS',
                description: 'Globally enable/disable system-generated emails',
                dataType: 'boolean',
                isPublic: false,
            },
            {
                key: 'NOTIFICATION_POLLING_INTERVAL_SEC',
                value: 30,
                category: 'SYSTEM_SETTINGS',
                description: 'Client-side notification polling interval in seconds',
                dataType: 'number',
                isPublic: true,
            },
            {
                key: 'MAINTENANCE_MODE',
                value: false,
                category: 'SECURITY',
                description: 'Disable application access for non-admin users',
                dataType: 'boolean',
                isPublic: true,
            },
            {
                key: 'ALLOW_NEW_REGISTRATIONS',
                value: true,
                category: 'FEATURE_FLAGS',
                description: 'Enable/disable student registration',
                dataType: 'boolean',
                isPublic: true,
            },
            {
                key: 'AUTO_LOGOUT_TIMEOUT_MIN',
                value: 30,
                category: 'SECURITY',
                description: 'Automatic logout after inactivity (minutes)',
                dataType: 'number',
                isPublic: true,
            },
        ];

        const results = await Promise.all(
            defaultConfigs.map(config =>
                SystemConfig.findOneAndUpdate(
                    { key: config.key },
                    { ...config, updatedBy: req.user._id },
                    { upsert: true, new: true }
                )
            )
        );

        res.json({ message: 'Default configurations initialized', configs: results });
    } catch (error) {
        console.error('Error initializing configs:', error);
        res.status(500).json({ message: 'Error initializing configs', error: error.message });
    }
};

export {
    getSystemConfigs,
    getConfigByKey,
    upsertConfig,
    deleteConfig,
    getFeatureFlags,
    initializeDefaultConfigs,
};
