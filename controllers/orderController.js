// const { QueryTypes } = require('sequelize');
// const { sequelize, Order, OrderItem, Customer, Employee, Product, Supplier } = require('../models');

const { sequelize, models ,myModels } = require('../models');
const order_items = require('../models/order_items');
// const order_items = require('../models/order_items');
// const products = require('../models/products');

const {  Order, OrderItem, Customer, Employee, Product, Supplier } = myModels


exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.findAll({
      include: [
        {
          model: OrderItem,
          as: "order_items",
          include: {
            model: Product,
            as: "product",
            attributes: ['id', 'name']
          },
          attributes: ['id', 'amount', 'price', 'discount']
        },
        { model: Customer, as: "customer", attributes: ['id', 'name'] },
        { model: Employee, as: "employee", attributes: ['id', 'name'] }
      ],
      attributes: ['id', 'date']
    });
    res.status(200).json({ orders });
  } catch (err) {
    next(err);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({
      where: { id },
      attributes: ['id', 'date'],
      include: [
        { model: Customer, as:"customer", attributes: ['id', 'name'] },
        { model: Employee, as:"employee", attributes: ['id', 'name'] },
        {
          model: OrderItem,
          as: "order_items",
          attributes: ['id', 'amount', 'price', 'discount'],
          include: { model: Product, as: "product", attributes: ['id', 'name'], include: {model: Supplier, as : "supplier" }  }
        }
      ]
    });
    res.status(200).json({ order });
  } catch (err) {
    next(err);
  }
};

exports.createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    console.log("Hey, Create :", req.body)
    const { customerId, employeeId, items } = req.body; // items = [{productId, amount, discount}]
    const order = await Order.create({ date: new Date(), customerId, employeeId }, { transaction });

    // const insertItems = await Promise.all(
    //   items.map(async item => {
    //     const product = await Product.findByPk(item.productId);
    //     item.price = product.price;
    //     item.orderId = order.id;
    //     return item;
    //   })
    // );

    // const orderItems = await OrderItem.bulkCreate(insertItems, { transaction });

    const orderItems = [];
    for (let item of items) {
      const product = await Product.findByPk(item.productId);
      const orderItem = await OrderItem.create(
        {
          productId: item.productId,
          amount: item.amount,
          discount: item.discount,
          price: product.price,
          orderId: order.id
        },
        { transaction }
      );
      orderItems.push(orderItem);
    }

    await transaction.commit();
    res.status(201).json({ order, orderItems });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

exports.deleteOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    await OrderItem.destroy({ where: { orderId: id } }, { transaction });
    await Order.destroy({ where: { id } }, { transaction });
    await transaction.commit();
    res.status(204).json();
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

exports.getTotalSale = async (req, res, next) => {
  try {
    // const result = await sequelize.query(
    //   'SELECT SUM(amount) AS totalAmount, SUM(price*amount*(1-discount)) AS totalSale FROM order_items',
    //   { type: QueryTypes.SELECT }
    // );

    const total = await OrderItem.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('SUM', sequelize.literal('amount*price*(1-discount)')), 'totalSale']
      ]
    });

    res.status(200).json({ total });
  } catch (err) {
    next(err);
  }
};

exports.getTotalSaleEachCustomer = async (req, res, next) => {
  try {
    const sql = `SELECT c.id, c.name, IFNULL(SUM(o2.amount), 0) AS totalAmount,
    IFNULL(SUM(o2.amount*o2.price*(1-o2.discount)), 0) AS totalSale
    FROM customers c LEFT JOIN orders o1 ON c.id = o1.customer_id
    LEFT JOIN order_items o2 ON o1.id = o2.order_id GROUP BY c.id HAVING totalSale > 10000`;
    const total = await sequelize.query(sql, { type: QueryTypes.SELECT });

    res.status(200).json({ total });
  } catch (err) {
    next(err);
  }
};
