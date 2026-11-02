const User = require('../models/User');
const crud = require('./crudFactory');

// Password is hashed by the model pre-save hook; empty password on edit is ignored.
const sanitize = (body) => {
  const data = { ...body };
  if (!data.password) delete data.password;
  if (!data.zone) data.zone = undefined; // allows clearing the zone
  return data;
};

module.exports = crud(User, {
  searchFields: ['name', 'email', 'mobile'],
  filterFields: ['role', 'isActive', 'zone'],
  populate: 'zone',
  sanitize,
});
