require("dotenv").config();

const verifyToken = require("./middleware/verifyToken");
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        // await client.connect();

        const db = client.db("recipehub");

        const usersCollection = db.collection("user");
        const recipesCollection = db.collection("recipes");
        const favoritesCollection = db.collection("favorites");
        const reportsCollection = db.collection("reports");
        const paymentsCollection = db.collection("payments");

        //create recipes
        app.post("/recipes", verifyToken, async (req, res) => {
            const recipe = req.body;
            const result =
                await recipesCollection.insertOne(recipe);
            res.send(result);
        });

        //get all recipes
        app.get("/recipes", async (req, res) => {
            const result = await recipesCollection.find().toArray();
            res.send(result);
        });
        //get users added recipes
        app.get("/my-recipes", verifyToken, async (req, res) => {
            try {
                const email = req.user.email;

                const recipes = await recipesCollection
                    .find({ authorEmail: email })
                    .toArray();

                res.send(recipes);

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: error.message,
                });
            }
        });
        //get recipe with ID
        app.get("/recipes/:id", async (req, res) => {
            const id = req.params.id;
            const result = await recipesCollection.findOne({
                _id: new ObjectId(id),
            });
            res.send(result);
        });

        //delete recipe
        // Delete Recipe
        app.delete("/recipes/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;

                const result = await recipesCollection.deleteOne({
                    _id: new ObjectId(id),
                    authorEmail: req.user.email,
                });

                if (result.deletedCount === 0) {
                    return res.status(403).send({
                        message: "You are not authorized to delete this recipe.",
                    });
                }

                res.send(result);
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Failed to delete recipe.",
                });
            }
        });


        // Update Recipe
        app.patch("/recipes/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;
                const updatedRecipe = req.body;

                // Prevent changing ownership fields
                delete updatedRecipe.authorId;
                delete updatedRecipe.authorName;
                delete updatedRecipe.authorEmail;
                delete updatedRecipe.authorImage;
                delete updatedRecipe.createdAt;

                updatedRecipe.updatedAt = new Date();

                const result = await recipesCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                        authorEmail: req.user.email,
                    },
                    {
                        $set: updatedRecipe,
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(403).send({
                        message: "You are not authorized to update this recipe.",
                    });
                }

                res.send(result);
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Failed to update recipe.",
                });
            }
        });
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

        //adding recipes in favorite collection
        app.post("/favorites", verifyToken, async (req, res) => {
            try {
                const { recipeId } = req.body;

                const userEmail = req.user.email;

                const existingFavorite = await favoritesCollection.findOne({
                    recipeId: new ObjectId(recipeId),
                    userEmail,
                });

                if (existingFavorite) {
                    return res.status(400).send({
                        message: "Recipe is already in your favorites.",
                    });
                }

                const favorite = {
                    recipeId: new ObjectId(recipeId),
                    userEmail,
                    createdAt: new Date(),
                };
                const result = await favoritesCollection.insertOne(favorite);

                res.status(201).send(result);
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Failed to add favorite.",
                });
            }
        });

        //get api of favorites
        app.get("/favorites", verifyToken, async (req, res) => {
            try {
                const userEmail = req.user.email;

                const favorites = await favoritesCollection.aggregate([
                    {
                        $match: {
                            userEmail,
                        },
                    },
                    {
                        $lookup: {
                            from: "recipes",
                            localField: "recipeId",
                            foreignField: "_id",
                            as: "recipe",
                        },
                    },
                    {
                        $unwind: "$recipe",
                    },
                    {
                        $project: {
                            _id: "$recipe._id",
                            recipeName: "$recipe.recipeName",
                            recipeImage: "$recipe.recipeImage",
                            category: "$recipe.category",
                            cuisineType: "$recipe.cuisineType",
                            preparationTime: "$recipe.preparationTime",
                            likesCount: "$recipe.likesCount",
                            createdAt: "$recipe.createdAt",
                        },
                    },
                ]).toArray();

                res.send(favorites);
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Failed to fetch favorites.",
                });
            }
        });

        //delete favorite recipe api
        app.delete("/favorites/:recipeId", verifyToken, async (req, res) => {
            try {
                const { recipeId } = req.params;

                if (!ObjectId.isValid(recipeId)) {
                    return res.status(400).send({
                        message: "Invalid recipe id.",
                    });
                }

                const result = await favoritesCollection.deleteOne({
                    recipeId: new ObjectId(recipeId),
                    userEmail: req.user.email,
                });

                if (result.deletedCount === 0) {
                    return res.status(404).send({
                        message: "Favorite not found.",
                    });
                }

                res.send({
                    message: "Favorite removed successfully.",
                });
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        });

        // Check favorite status
        app.get("/favorites/check/:recipeId", verifyToken, async (req, res) => {
            try {
                const { recipeId } = req.params;
                const userEmail = req.user.email;

                if (!ObjectId.isValid(recipeId)) {
                    return res.status(400).send({
                        message: "Invalid recipe id.",
                    });
                }

                const favorite = await favoritesCollection.findOne({
                    recipeId: new ObjectId(recipeId),
                    userEmail,
                });

                res.send({
                    isFavorite: !!favorite,
                });
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    message: "Internal Server Error",
                });
            }
        });

        //free user limit features
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

        

        console.log("MongoDB Connected Successfully");
    } finally {
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});