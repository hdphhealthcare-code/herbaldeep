const express = require('express');
const { protect, authorize } = require('../middleware/auth');

// Builds a standard REST router from CRUD handlers + allowed roles.
module.exports = (handlers, roles, { readRoles = roles } = {}) => {
  const router = express.Router();
  router.use(protect);
  router.get('/', authorize(...readRoles), handlers.list);
  router.get('/:id', authorize(...readRoles), handlers.getOne);
  router.post('/', authorize(...roles), handlers.create);
  router.put('/:id', authorize(...roles), handlers.update);
  router.delete('/:id', authorize(...roles), handlers.remove);
  return router;
};
