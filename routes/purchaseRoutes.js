const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function (
    stripe,
    paymentsCollection,
    recipesCollection,
    verifyToken
) {
    const router = express.Router();

    // Create Recipe Purchase Checkout Session
    router.post(
        "/create-checkout-session",
        verifyToken,
        async (req, res) => {
            try {
                const { recipeId } = req.body;

                if (!recipeId) {
                    return res.status(400).send({
                        message: "Recipe ID is required.",
                    });
                }

                const recipe = await recipesCollection.findOne({
                    _id: new (require("mongodb").ObjectId)(recipeId),
                });

                if (!recipe) {
                    return res.status(404).send({
                        message: "Recipe not found.",
                    });
                }

                // Prevent duplicate purchase
                const existingPurchase =
                    await paymentsCollection.findOne({
                        userEmail: req.user.email,
                        recipeId,
                        purchaseType: "recipe",
                    });

                if (existingPurchase) {
                    return res.status(400).send({
                        message:
                            "You have already purchased this recipe.",
                    });
                }

                const session =
                    await stripe.checkout.sessions.create({
                        payment_method_types: ["card"],

                        mode: "payment",

                        customer_email: req.user.email,
                        metadata: {
                            recipeId,
                            recipeName: recipe.recipeName,
                        },

                        line_items: [
                            {
                                price_data: {
                                    currency: "USD",

                                    product_data: {
                                        name: recipe.recipeName,
                                    },

                                    // Change this later if you store recipe price
                                    unit_amount: 100,
                                },

                                quantity: 1,
                            },
                        ],

                        success_url:
                            `${process.env.CLIENT_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}&recipeId=${recipeId}`,

                        cancel_url:
                            `${process.env.CLIENT_URL}/recipes/${recipeId}`,
                    });

                res.send({
                    url: session.url,
                });

            } catch (error) {

                console.error(error);

                res.status(500).send({
                    message:
                        "Failed to create checkout session.",
                });

            }
        }
    );

    router.post(
        "/payment-success",
        verifyToken,
        async (req, res) => {
            try {
                const { sessionId, recipeId } = req.body;

                if (!sessionId || !recipeId) {
                    return res.status(400).send({
                        message: "Session ID and Recipe ID are required.",
                    });
                }

                const session = await stripe.checkout.sessions.retrieve(sessionId);

                if (session.payment_status !== "paid") {
                    return res.status(400).send({
                        message: "Payment not completed.",
                    });
                }

                const existingPurchase = await paymentsCollection.findOne({
                    stripeSessionId: session.id,
                    purchaseType: "recipe",
                });

                if (existingPurchase) {
                    return res.send({
                        message: "Recipe already purchased.",
                    });
                }

                await paymentsCollection.insertOne({
                    purchaseType: "recipe",
                    recipeId,
                    recipeName: session.metadata.recipeName,
                    userEmail: req.user.email,
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    stripeSessionId: session.id,
                    transactionId: session.payment_intent,
                    paymentStatus: session.payment_status,
                    paidAt: new Date(),
                });

                res.send({
                    message: "Recipe purchased successfully.",
                });

            } catch (error) {

                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });

            }
        }
    );

    // Get Purchased Recipes
    router.get(
        "/my-purchases",
        verifyToken,
        async (req, res) => {
            try {
                const purchases = await paymentsCollection
                    .find({
                        userEmail: req.user.email,
                        purchaseType: "recipe",
                    })
                    .sort({
                        paidAt: -1,
                    })
                    .toArray();

                const recipeIds = purchases.map(
                    (purchase) => new ObjectId(purchase.recipeId)
                );

                const recipes = await recipesCollection
                    .find({
                        _id: {
                            $in: recipeIds,
                        },
                    })
                    .toArray();

                const purchasedRecipes = purchases.map((purchase) => {
                    const recipe = recipes.find(
                        (item) =>
                            item._id.toString() ===
                            purchase.recipeId.toString()
                    );

                    return {
                        ...recipe,
                        paidAt: purchase.paidAt,
                        amount: purchase.amount,
                        transactionId: purchase.transactionId,
                    };
                });

                res.send(purchasedRecipes);

            } catch (error) {

                console.error(error);

                res.status(500).send({
                    message: "Failed to fetch purchased recipes.",
                });

            }
        }
    );

    return router;
};