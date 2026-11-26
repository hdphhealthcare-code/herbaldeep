// Completed = delivered to the customer. Their money is the revenue shown on the dashboard and on the orders page.
exports.COMPLETED = ['delivered', 'invoice_generated'];

// Money received for one order: a COD order brings the COD amount that was collected (the full total when none was set), a prepaid order its total
exports.receivedExpr = {
  $cond: [
    { $and: [{ $eq: ['$payment.type', 'COD'] }, { $gt: ['$payment.codAmount', 0] }] },
    '$payment.codAmount',
    '$totalAmount',
  ],
};
