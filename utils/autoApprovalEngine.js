import AutoApprovalRule from '../models/AutoApprovalRule.js';

/**
 * Evaluates a request against active auto-approval rules.
 * @param {Object} requestData - The request object (should contain field values).
 * @param {String} requestType - 'Excuse', 'Leave', or 'Letter'.
 * @returns {Boolean} - True if request should be auto-approved, False otherwise.
 */
export const evaluateAutoApproval = async (requestData, requestType) => {
    try {
        // Fetch active rules for this request type, sorted by priority (high to low)
        const rules = await AutoApprovalRule.find({
            requestType,
            isActive: true
        }).sort({ priority: -1 });

        if (!rules || rules.length === 0) return false;

        // Augment requestData with calculated fields if necessary
        const augmentedData = { ...requestData };
        if (requestType === 'Leave' && requestData.startDate && requestData.endDate) {
            const start = new Date(requestData.startDate);
            const end = new Date(requestData.endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
            augmentedData.durationDays = diffDays;
        }

        // Check each rule
        for (const rule of rules) {
            let allConditionsMet = true;

            for (const condition of rule.conditions) {
                const { field, operator, value } = condition;
                const requestValue = augmentedData[field];

                // If field is missing in request, condition fails (fail-safe)
                if (requestValue === undefined || requestValue === null) {
                    allConditionsMet = false;
                    break;
                }

                let conditionMet = false;
                switch (operator) {
                    case 'equals':
                        conditionMet = requestValue == value; // Allow loose equality (e.g. 5 == '5')
                        break;
                    case 'notEquals':
                        conditionMet = requestValue != value;
                        break;
                    case 'greaterThan':
                        conditionMet = parseFloat(requestValue) > parseFloat(value);
                        break;
                    case 'lessThan':
                        conditionMet = parseFloat(requestValue) < parseFloat(value);
                        break;
                    case 'contains':
                        conditionMet = String(requestValue).toLowerCase().includes(String(value).toLowerCase());
                        break;
                    default:
                        conditionMet = false;
                }

                if (!conditionMet) {
                    allConditionsMet = false;
                    break;
                }
            }

            // If a rule matches, return true immediately (Auto Approve)
            // Assuming ALL rules are "Auto Approve" rules for now.
            if (allConditionsMet) {
                console.log(`Auto-approval triggered by rule: ${rule.name}`);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error("Error evaluating auto-approval rules:", error);
        return false; // Fail safe: do not auto-approve on error
    }
};
