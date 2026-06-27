const express = require("express");
const { ObjectId } = require("mongodb");

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

    // Get All Users
    router.get(
        "/users",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { search = "" } = req.query;

                const query = {};

                if (search) {
                    query.$or = [
                        {
                            name: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                        {
                            email: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                    ];
                }

                const users = await usersCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send(users);

                res.send(users);
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );

    // Make Admin
    router.patch(
        "/users/:id/role",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        message: "Invalid user id.",
                    });
                }

                const user = await usersCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!user) {
                    return res.status(404).send({
                        message: "User not found.",
                    });
                }

                if (user.role === "admin") {
                    return res.status(400).send({
                        message: "User is already an admin.",
                    });
                }

                const result = await usersCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                    },
                    {
                        $set: {
                            role: "admin",
                        },
                    }
                );

                res.send({
                    message: "User promoted to admin successfully.",
                    result,
                });
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );

    // Remove Admin
    router.patch(
        "/users/:id/remove-role",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        message: "Invalid user id.",
                    });
                }

                const user = await usersCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!user) {
                    return res.status(404).send({
                        message: "User not found.",
                    });
                }

                if (user.role !== "admin") {
                    return res.status(400).send({
                        message: "User is not an admin.",
                    });
                }

                const adminCount =
                    await usersCollection.countDocuments({
                        role: "admin",
                    });

                if (adminCount === 1) {
                    return res.status(400).send({
                        message: "At least one admin must remain.",
                    });
                }
                if (user.email === req.user.email) {
                    return res.status(400).send({
                        message: "You cannot remove your own admin role.",
                    });
                }

                await usersCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                    },
                    {
                        $set: {
                            role: "user",
                        },
                    }
                );

                res.send({
                    message: "Admin removed successfully.",
                });

            } catch (error) {

                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });

            }
        }
    );

    // Block / Unblock User
    router.patch(
        "/users/:id/block",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        message: "Invalid user id.",
                    });
                }

                const user = await usersCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!user) {
                    return res.status(404).send({
                        message: "User not found.",
                    });
                }

                // Prevent blocking yourself
                if (user.email === req.user.email) {
                    return res.status(400).send({
                        message: "You cannot block your own account.",
                    });
                }

                const isBlocked = user.isBlocked ?? false;

                await usersCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                    },
                    {
                        $set: {
                            isBlocked: !isBlocked,
                        },
                    }
                );

                res.send({
                    message: isBlocked
                        ? "User unblocked successfully."
                        : "User blocked successfully.",
                });
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );

    // Delete User
    router.delete(
        "/users/:id",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        message: "Invalid user id.",
                    });
                }

                const user = await usersCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!user) {
                    return res.status(404).send({
                        message: "User not found.",
                    });
                }

                // Prevent deleting yourself
                if (user.email === req.user.email) {
                    return res.status(400).send({
                        message: "You cannot delete your own account.",
                    });
                }

                // Prevent deleting the last admin
                if (user.role === "admin") {
                    const adminCount = await usersCollection.countDocuments({
                        role: "admin",
                    });

                    if (adminCount === 1) {
                        return res.status(400).send({
                            message: "At least one admin must remain.",
                        });
                    }
                }

                const result = await usersCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                res.send({
                    message: "User deleted successfully.",
                    result,
                });

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );


    // Get All Recipes
    router.get(
        "/recipes",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { search = "" } = req.query;

                const query = {};

                if (search) {
                    query.$or = [
                        {
                            recipeName: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                        {
                            authorName: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                        {
                            category: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                    ];
                }

                const recipes = await recipesCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send(recipes);

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );

    // Feature / Unfeature Recipe
    router.patch(
        "/recipes/:id/feature",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        message: "Invalid recipe id.",
                    });
                }

                const recipe = await recipesCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!recipe) {
                    return res.status(404).send({
                        message: "Recipe not found.",
                    });
                }

                const featured = recipe.featured ?? false;

                await recipesCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                    },
                    {
                        $set: {
                            featured: !featured,
                        },
                    }
                );

                res.send({
                    message: featured
                        ? "Recipe removed from featured successfully."
                        : "Recipe featured successfully.",
                });

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );

    // Admin Update Recipe
    router.patch(
        "/recipes/:id",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        message: "Invalid recipe id.",
                    });
                }

                const recipe = await recipesCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!recipe) {
                    return res.status(404).send({
                        message: "Recipe not found.",
                    });
                }

                const updatedRecipe = {
                    recipeName: req.body.recipeName,
                    recipeImage: req.body.recipeImage,
                    category: req.body.category,
                    cuisineType: req.body.cuisineType,
                    preparationTime: req.body.preparationTime,
                    ingredients: req.body.ingredients,
                    instructions: req.body.instructions,
                    difficultyLevel: req.body.difficultyLevel,
                };

                await recipesCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                    },
                    {
                        $set: updatedRecipe,
                    }
                );

                res.send({
                    message: "Recipe updated successfully.",
                });

            } catch (error) {

                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });

            }
        }
    );

    // Delete Recipe
    router.delete(
        "/recipes/:id",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        message: "Invalid recipe id.",
                    });
                }

                const recipe = await recipesCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!recipe) {
                    return res.status(404).send({
                        message: "Recipe not found.",
                    });
                }

                await recipesCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                res.send({
                    message: "Recipe deleted successfully.",
                });

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );

    // Get All Reports
    router.get(
        "/reports",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { search = "" } = req.query;

                const query = {};

                if (search) {
                    query.$or = [
                        {
                            recipeName: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                        {
                            reporterEmail: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                        {
                            reportReason: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                    ];
                }

                const reports = await reportsCollection
                    .find(query)
                    .sort({
                        createdAt: -1,
                    })
                    .toArray();

                res.send(reports);

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );

    // Delete Report
    router.delete(
        "/reports/:id",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        message: "Invalid report id.",
                    });
                }

                const report = await reportsCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!report) {
                    return res.status(404).send({
                        message: "Report not found.",
                    });
                }

                await reportsCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                res.send({
                    message: "Report deleted successfully.",
                });

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );

    // Delete Reported Recipe
    router.delete(
        "/reports/:id/recipe",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({
                        message: "Invalid report id.",
                    });
                }

                const report = await reportsCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!report) {
                    return res.status(404).send({
                        message: "Report not found.",
                    });
                }

                await recipesCollection.deleteOne({
                    _id: report.recipeId,
                });

                await reportsCollection.deleteMany({
                    recipeId: report.recipeId,
                });

                res.send({
                    message: "Recipe and all related reports deleted successfully.",
                });

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        }
    );

    // Get All Transactions
    router.get(
        "/transactions",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            try {
                const { search = "" } = req.query;

                const query = {};

                if (search) {
                    query.$or = [
                        {
                            userEmail: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                        {
                            transactionId: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                        {
                            paymentStatus: {
                                $regex: search,
                                $options: "i",
                            },
                        },
                    ];
                }

                const transactions = await paymentsCollection
                    .find(query)
                    .sort({
                        paidAt: -1,
                    })
                    .toArray();

                res.send(transactions);

            } catch (error) {

                console.error(error);

                res.status(500).send({
                    message: "Failed to fetch transactions.",
                });

            }
        }
    );

    return router;
};