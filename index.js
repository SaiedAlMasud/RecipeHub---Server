require("dotenv").config();

const verifyToken = require("./middleware/verifyToken");
const express = require("express");
const cors = require("cors");
const recipeRoutes = require("./routes/recipeRoutes");
const connectDB = require("./config/db");
const stripe = require("./config/stripe");
const favoriteRoutes = require("./routes/favoriteRoutes");

const app = express();
const port = process.env.PORT || 5000;
// Middleware
app.use(cors());
app.use(express.json());

async function run() {
    try {
        const {
            db,
            usersCollection,
            recipesCollection,
            favoritesCollection,
            reportsCollection,
            paymentsCollection,
        } = await connectDB();

        app.use(
            "/recipes",
            recipeRoutes(
                recipesCollection,
                verifyToken
            )
        );

        app.use(
            "/favorites",
            favoriteRoutes(
                favoritesCollection,
                recipesCollection,
                verifyToken
            )
        );

        //user profile CRUD
        app.get("/profile", verifyToken, async (req, res) => {
            try {
                const email = req.user.email;

                const user = await db.collection("user").findOne({
                    email,
                });

                if (!user) {
                    return res.status(404).send({
                        message: "User not found",
                    });
                }

                res.send(user);
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: error.message,
                });
            }
        });

        //Update profile
        app.patch("/profile", verifyToken, async (req, res) => {
            try {
                const email = req.user.email;

                const { name, image } = req.body;

                const result = await db.collection("user").updateOne(
                    { email },
                    {
                        $set: {
                            name,
                            image,
                        },
                    }
                );

                res.send(result);
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: error.message,
                });
            }
        });

        
        // Recipe limit API
        app.get("/recipe-limit", verifyToken, async (req, res) => {
            try {
                const userEmail = req.user.email;

                const user = await usersCollection.findOne({
                    email: userEmail,
                });

                if (!user) {
                    return res.status(404).send({
                        message: "User not found.",
                    });
                }

                const recipeCount = await recipesCollection.countDocuments({
                    authorEmail: userEmail,
                });

                const maxRecipes = 2;

                res.send({
                    isPremium: user.isPremium,
                    recipeCount,
                    remaining: user.isPremium
                        ? "Unlimited"
                        : Math.max(maxRecipes - recipeCount, 0),
                    canAddRecipe:
                        user.isPremium || recipeCount < maxRecipes,
                });
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        });

        //stripe payment api
        app.post(
            "/create-checkout-session",
            verifyToken,
            async (req, res) => {
                try {
                    const { email } = req.user;

                    const session = await stripe.checkout.sessions.create({
                        payment_method_types: ["card"],

                        mode: "payment",

                        customer_email: email,

                        line_items: [
                            {
                                price_data: {
                                    currency: "bdt",

                                    product_data: {
                                        name: "RecipeHub Premium Membership",
                                    },

                                    unit_amount: 49900,
                                },

                                quantity: 1,
                            },
                        ],

                        success_url:
                            `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

                        cancel_url:
                            `${process.env.CLIENT_URL}/payment`,
                    });

                    res.send({
                        url: session.url,
                    });

                } catch (error) {

                    console.error(error);

                    res.status(500).send({
                        message: "Failed to create checkout session.",
                    });
                }
            }
        );

        app.post("/payment-success", verifyToken, async (req, res) => {
            try {
                const { sessionId } = req.body;

                if (!sessionId) {
                    return res.status(400).send({
                        message: "Session ID is required.",
                    });
                }

                const session = await stripe.checkout.sessions.retrieve(sessionId);

                if (session.payment_status !== "paid") {
                    return res.status(400).send({
                        message: "Payment not completed.",
                    });
                }

                // Prevent duplicate payment records
                const existingPayment = await paymentsCollection.findOne({
                    stripeSessionId: session.id,
                });

                if (existingPayment) {
                    return res.send({
                        message: "Payment already processed.",
                    });
                }

                await paymentsCollection.insertOne({
                    stripeSessionId: session.id,
                    paymentIntentId: session.payment_intent,
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    paymentStatus: session.payment_status,
                    createdAt: new Date(),
                });

                await usersCollection.updateOne(
                    {
                        email: req.user.email,
                    },
                    {
                        $set: {
                            isPremium: true,
                        },
                    }
                );

                res.send({
                    message: "Premium activated successfully.",
                });

            } catch (error) {

                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });

            }
        });


    } finally {
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});