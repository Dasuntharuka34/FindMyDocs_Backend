import AutoApprovalRule from '../models/AutoApprovalRule.js';

// @desc    Create a new rule
// @route   POST /api/auto-approval-rules
// @access  Private/Admin
const createRule = async (req, res) => {
    try {
        const { name, requestType, conditions, priority, isActive } = req.body;

        const ruleExists = await AutoApprovalRule.findOne({ name });
        if (ruleExists) {
            return res.status(400).json({ message: 'Rule with this name already exists' });
        }

        const rule = await AutoApprovalRule.create({
            name,
            requestType,
            conditions,
            priority,
            isActive,
            createdBy: req.user._id
        });

        res.status(201).json(rule);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all rules
// @route   GET /api/auto-approval-rules
// @access  Private/Admin
const getRules = async (req, res) => {
    try {
        const rules = await AutoApprovalRule.find({}).sort({ priority: -1, createdAt: -1 });
        res.json(rules);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update rule
// @route   PUT /api/auto-approval-rules/:id
// @access  Private/Admin
const updateRule = async (req, res) => {
    try {
        const { name, requestType, conditions, priority, isActive } = req.body;

        const rule = await AutoApprovalRule.findById(req.params.id);

        if (rule) {
            rule.name = name || rule.name;
            rule.requestType = requestType || rule.requestType;
            rule.conditions = conditions || rule.conditions;
            rule.priority = priority !== undefined ? priority : rule.priority;
            if (isActive !== undefined) rule.isActive = isActive;

            const updatedRule = await rule.save();
            res.json(updatedRule);
        } else {
            res.status(404).json({ message: 'Rule not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete rule
// @route   DELETE /api/auto-approval-rules/:id
// @access  Private/Admin
const deleteRule = async (req, res) => {
    try {
        const rule = await AutoApprovalRule.findById(req.params.id);

        if (rule) {
            await rule.deleteOne();
            res.json({ message: 'Rule removed' });
        } else {
            res.status(404).json({ message: 'Rule not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Toggle active status
// @route   PATCH /api/auto-approval-rules/:id/toggle
// @access  Private/Admin
const toggleRuleStatus = async (req, res) => {
    try {
        const rule = await AutoApprovalRule.findById(req.params.id);
        if (rule) {
            rule.isActive = !rule.isActive;
            await rule.save();
            res.json(rule);
        } else {
            res.status(404).json({ message: 'Rule not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export {
    createRule,
    getRules,
    updateRule,
    deleteRule,
    toggleRuleStatus
};
