const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');

const SUPER_ADMIN_EMAIL = 'admin@gmail.com';
const SUPER_ADMIN_PASSWORD = 'admin123';

async function ensureSuperAdmin() {
  if (await Staff.exists({ role: 'Super Admin' })) return false;

  const emailTaken = await Staff.exists({ email: SUPER_ADMIN_EMAIL });
  if (emailTaken) {
    console.warn(`[superAdmin] ${SUPER_ADMIN_EMAIL} belongs to an existing non-admin account; no Super Admin created`);
    return false;
  }

  await Staff.create({
    name: 'Super Admin',
    email: SUPER_ADMIN_EMAIL,
    password: await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10),
    role: 'Super Admin',
    status: 'Active',
    branch: '',
    branchAccess: [],
    hireDate: new Date().toISOString().slice(0, 10),
    department: 'Administration',
    employmentType: 'Full-time',
  });
  console.log(`[superAdmin] Created Super Admin account ${SUPER_ADMIN_EMAIL}`);
  return true;
}

module.exports = { ensureSuperAdmin };
