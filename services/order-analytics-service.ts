
import Order from "@/models/Order";

export async function getCategorySalesLast30Days() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        paymentStatus: "paid",
      },
    },
    {
      $unwind: "$items",
    },
    {
      $lookup: {
        from: "products",
        localField: "items.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $unwind: "$product",
    },
    {
      $group: {
        _id: "$product.category",
        totalRevenue: {
          $sum: {
            $multiply: ["$items.quantity", "$items.unitAmount"],
          },
        },
        totalUnitsSold: {
          $sum: "$items.quantity",
        },
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        totalRevenue: 1,
        totalUnitsSold: 1,
      },
    },
    {
      $sort: {
        totalRevenue: -1,
      },
    },
  ]);
}
