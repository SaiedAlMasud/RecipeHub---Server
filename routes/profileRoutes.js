const express = require("express");

module.exports = function (
    usersCollection,
    verifyToken
) {
    const router = express.Router();

    // Get Profile
    router.get("/", verifyToken, async (req, res) => {
        try {
            const profile = await usersCollection.findOne(
                {
                    email: req.user.email,
                }
            );

            if (!profile) {
                return res.status(404).send({
                    message: "User not found.",
                });
            }

            res.send(profile);

        } catch (error) {

            console.error(error);

            res.status(500).send({
                message: "Internal Server Error",
            });

        }
    });

    // Update Profile
    router.patch("/", verifyToken, async (req, res) => {
        try {

            const { name, image } = req.body;

            const updateDoc = {
                $set: {
                    name,
                    image,
                },
            };

            const result =
                await usersCollection.updateOne(
                    {
                        email: req.user.email,
                    },
                    updateDoc
                );

            res.send(result);

        } catch (error) {

            console.error(error);

            res.status(500).send({
                message: "Internal Server Error",
            });

        }
    });

    return router;
};