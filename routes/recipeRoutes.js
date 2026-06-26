const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function (recipesCollection, verifyToken) {
    const router = express.Router();

    // Create Recipe
    router.post("/", verifyToken, async (req, res) => {
        try {
            const recipe = req.body;

            const result = await recipesCollection.insertOne(recipe);

            res.send(result);
        } catch (error) {
            console.error(error);

            res.status(500).send({
                message: "Failed to add recipe.",
            });
        }
    });

    // Get All Recipes
    router.get("/", async (req, res) => {
        try {
            const recipes = await recipesCollection
                .find()
                .toArray();

            res.send(recipes);
        } catch (error) {
            console.error(error);

            res.status(500).send({
                message: "Failed to fetch recipes.",
            });
        }
    });

    // Get Logged-in User Recipes
    router.get("/my-recipes", verifyToken, async (req, res) => {
        try {
            const recipes =
                await recipesCollection
                    .find({
                        authorEmail: req.user.email,
                    })
                    .toArray();

            res.send(recipes);

        } catch (error) {
            console.error(error);

            res.status(500).send({
                message: error.message,
            });
        }
    });

    // Get Recipe by ID
    router.get("/:id", async (req, res) => {
        try {
            const { id } = req.params;

            const recipe =
                await recipesCollection.findOne({
                    _id: new ObjectId(id),
                });

            res.send(recipe);

        } catch (error) {

            console.error(error);

            res.status(500).send({
                message: "Failed to fetch recipe.",
            });

        }
    });

    // Update Recipe
    router.patch("/:id", verifyToken, async (req, res) => {
        try {
            const { id } = req.params;

            const updatedRecipe = req.body;

            delete updatedRecipe.authorId;
            delete updatedRecipe.authorName;
            delete updatedRecipe.authorEmail;
            delete updatedRecipe.authorImage;
            delete updatedRecipe.createdAt;

            updatedRecipe.updatedAt = new Date();

            const result =
                await recipesCollection.updateOne(
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
                    message:
                        "You are not authorized to update this recipe.",
                });
            }

            res.send(result);

        } catch (error) {

            console.error(error);

            res.status(500).send({
                message:
                    "Failed to update recipe.",
            });

        }
    });

    // Delete Recipe
    router.delete("/:id", verifyToken, async (req, res) => {
        try {
            const { id } = req.params;

            const result =
                await recipesCollection.deleteOne({
                    _id: new ObjectId(id),
                    authorEmail: req.user.email,
                });

            if (result.deletedCount === 0) {
                return res.status(403).send({
                    message:
                        "You are not authorized to delete this recipe.",
                });
            }

            res.send(result);

        } catch (error) {

            console.error(error);

            res.status(500).send({
                message:
                    "Failed to delete recipe.",
            });

        }
    });

    return router;
};