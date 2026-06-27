const express = require("express");

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

                        line_items: [
                            {
                                price_data: {
                                    currency: "bdt",

                                    product_data: {
                                        name: recipe.recipeName,
                                    },

                                    // Change this later if you store recipe price
                                    unit_amount: 19900,
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

    return router;
};