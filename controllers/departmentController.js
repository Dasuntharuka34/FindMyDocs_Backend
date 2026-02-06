import Department from '../models/Department.js';

// @desc    Get all departments
// @route   GET /api/departments
// @access  Public
export const getDepartments = async (req, res) => {
    try {
        const departments = await Department.find({ isActive: true }).populate('hod', 'name email');
        res.json(departments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching departments', error: error.message });
    }
};

// @desc    Get all departments including inactive (Admin only)
// @route   GET /api/departments/admin
// @access  Private/Admin
export const getAllDepartmentsAdmin = async (req, res) => {
    try {
        const departments = await Department.find({}).populate('hod', 'name email');
        res.json(departments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching departments', error: error.message });
    }
};

// @desc    Create a department
// @route   POST /api/departments
// @access  Private/Admin
export const createDepartment = async (req, res) => {
    try {
        const { name, code, description, hod, isActive } = req.body;

        const departmentExists = await Department.findOne({ $or: [{ name }, { code }] });
        if (departmentExists) {
            return res.status(400).json({ message: 'Department with this name or code already exists' });
        }

        const department = await Department.create({
            name,
            code,
            description,
            hod,
            isActive
        });

        res.status(201).json(department);
    } catch (error) {
        res.status(500).json({ message: 'Error creating department', error: error.message });
    }
};

// @desc    Update a department
// @route   PUT /api/departments/:id
// @access  Private/Admin
export const updateDepartment = async (req, res) => {
    try {
        const { name, code, description, hod, isActive } = req.body;

        const department = await Department.findById(req.params.id);
        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        department.name = name || department.name;
        department.code = code || department.code;
        department.description = description || department.description;
        department.hod = hod || department.hod;
        department.isActive = isActive !== undefined ? isActive : department.isActive;

        const updatedDepartment = await department.save();
        res.json(updatedDepartment);
    } catch (error) {
        res.status(500).json({ message: 'Error updating department', error: error.message });
    }
};

// @desc    Delete a department
// @route   DELETE /api/departments/:id
// @access  Private/Admin
export const deleteDepartment = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);
        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        await department.deleteOne();
        res.json({ message: 'Department removed' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting department', error: error.message });
    }
};
