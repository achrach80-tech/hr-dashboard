// hashPassword.js
const bcrypt = require('bcryptjs');
const password = 'YourSecureAdminPassword123!';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);