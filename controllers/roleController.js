import Role from '../models/Role.js';

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private/Admin
export const getRoles = async (req, res) => {
    try {
        const roles = await Role.find({});
        res.json(roles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching roles', error: error.message });
    }
};

// @desc    Create a role
// @route   POST /api/roles
// @access  Private/Admin
export const createRole = async (req, res) => {
    try {
        const { name, description, permissions } = req.body;

        const roleExists = await Role.findOne({ name });
        if (roleExists) {
            return res.status(400).json({ message: 'Role with this name already exists' });
        }

        const role = await Role.create({
            name,
            description,
            permissions,
            isSystemRole: false
        });

        res.status(201).json(role);
    } catch (error) {
        res.status(500).json({ message: 'Error creating role', error: error.message });
    }
};

// @desc    Update a role
// @route   PUT /api/roles/:id
// @access  Private/Admin
export const updateRole = async (req, res) => {
    try {
        const { name, description, permissions } = req.body;

        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (role.isSystemRole && name !== role.name) {
            return res.status(400).json({ message: 'Cannot rename system roles' });
        }

        role.name = name || role.name;
        role.description = description || role.description;
        role.permissions = permissions || role.permissions;

        const updatedRole = await role.save();
        res.json(updatedRole);
    } catch (error) {
        res.status(500).json({ message: 'Error updating role', error: error.message });
    }
};

// @desc    Delete a role
// @route   DELETE /api/roles/:id
// @access  Private/Admin
export const deleteRole = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (role.isSystemRole) {
            return res.status(400).json({ message: 'Cannot delete system roles' });
        }

        await role.deleteOne();
        res.json({ message: 'Role removed' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting role', error: error.message });
    }
};

// @desc    Initialize default roles
// @route   POST /api/roles/initialize
// @access  Private/Admin
export const initializeRoles = async (req, res) => {
    try {
        const allPermissions = [
            'VIEW_ANALYTICS', 'MANAGE_USERS', 'MANAGE_SYSTEM_CONFIG',
            'MANAGE_DEPARTMENTS', 'MANAGE_EMAIL_TEMPLATES', 'SEND_BULK_EMAILS',
            'VIEW_EMAIL_LOGS', 'MANAGE_DATABASE', 'CLEANUP_DATA',
            'MANAGE_AUTO_APPROVAL', 'MANAGE_FORMS', 'VIEW_AUDIT_LOGS', 'APPROVE_REGISTRATIONS'
        ];

        const defaultRoles = [
            {
                name: 'Admin',
                description: 'Full system access',
                permissions: allPermissions,
                isSystemRole: true
            },
            {
                name: 'Student',
                description: 'Standard student access',
                permissions: [],
                isSystemRole: true
            },
            {
                name: 'Lecturer',
                description: 'Academic staff access',
                permissions: [],
                isSystemRole: true
            },
            {
                name: 'HOD',
                description: 'Head of Department access',
                permissions: ['APPROVE_REGISTRATIONS'],
                isSystemRole: true
            }
        ];

        for (const roleData of defaultRoles) {
            await Role.findOneAndUpdate(
                { name: roleData.name },
                roleData,
                { upsert: true, new: true }
            );
        }

        res.json({ message: 'Roles initialized successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error initializing roles', error: error.message });
    }
};
