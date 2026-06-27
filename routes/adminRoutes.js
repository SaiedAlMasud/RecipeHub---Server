const express = require("express");

module.exports = function (
    usersCollection,
    recipesCollection,
    reportsCollection,
    paymentsCollection,
    verifyToken,
    verifyAdmin
) {
    const router = express.Router();

    // Dashboard Statistics
    router.get(
        "/dashboard",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const totalUsers =
                    await usersCollection.countDocuments();

                const totalRecipes =
                    await recipesCollection.countDocuments();

                const premiumUsers =
                    await usersCollection.countDocuments({
                        isPremium: true,
                    });

                const totalReports =
                    await reportsCollection.countDocuments();

                const payments =
                    await paymentsCollection.find().toArray();

                const totalRevenue =
                    payments.reduce(
                        (sum, payment) =>
                            sum + (payment.amount || 0),
                        0
                    );

                res.send({
                    totalUsers,
                    totalRecipes,
                    premiumUsers,
                    totalReports,
                    totalRevenue,
                });

            } catch (error) {

                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });

            }
        }
    );

    return router;
};