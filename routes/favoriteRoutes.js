const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function (
    favoritesCollection,
    recipesCollection,
    verifyToken
) {
    const router = express.Router();

    // Add Favorite
    router.post("/", verifyToken, async (req, res) => {
        try {
            const { recipeId } = req.body;

            if (!ObjectId.isValid(recipeId)) {
                return res.status(400).send({
                    message: "Invalid recipe id.",
                });
            }

            const recipe = await recipesCollection.findOne({
                _id: new ObjectId(recipeId),
            });

            if (!recipe) {
                return res.status(404).send({
                    message: "Recipe not found.",
                });
            }

            const alreadyExists =
                await favoritesCollection.findOne({
                    recipeId: new ObjectId(recipeId),
                    userEmail: req.user.email,
                });

            if (alreadyExists) {
                return res.status(409).send({
                    message: "Recipe already in favorites.",
                });
            }

            const result =
                await favoritesCollection.insertOne({
                    recipeId: new ObjectId(recipeId),
                    userEmail: req.user.email,
                    createdAt: new Date(),
                });

            res.send(result);

        } catch (error) {

            console.error(error);

            res.status(500).send({
                message: "Internal Server Error",
            });

        }
    });

    // Get Favorite Recipes
    router.get("/", verifyToken, async (req, res) => {
        try {

            const favorites =
                await favoritesCollection
                    .find({
                        userEmail: req.user.email,
                    })
                    .toArray();

            const recipeIds =
                favorites.map((favorite) => favorite.recipeId);

            const recipes =
                await recipesCollection
                    .find({
                        _id: {
                            $in: recipeIds,
                        },
                    })
                    .toArray();

            res.send(recipes);

        } catch (error) {

            console.error(error);

            res.status(500).send({
                message: "Internal Server Error",
            });

        }
    });

    // Check Favorite
    router.get("/:recipeId", verifyToken, async (req, res) => {
        try {

            const { recipeId } = req.params;

            if (!ObjectId.isValid(recipeId)) {
                return res.status(400).send({
                    isFavorite: false,
                });
            }

            const favorite =
                await favoritesCollection.findOne({
                    recipeId: new ObjectId(recipeId),
                    userEmail: req.user.email,
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

    // Remove Favorite
    router.delete("/:recipeId", verifyToken, async (req, res) => {
        try {

            const { recipeId } = req.params;

            if (!ObjectId.isValid(recipeId)) {
                return res.status(400).send({
                    message: "Invalid recipe id.",
                });
            }

            const result =
                await favoritesCollection.deleteOne({
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

    return router;
};