const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function (
    reportsCollection,
    verifyToken
) {
    const router = express.Router();

    router.post(
        "/",
        verifyToken,
        async (req, res) => {
            try {
                const report = req.body;
                if (!ObjectId.isValid(report.recipeId)) {
                    return res.status(400).send({
                        message: "Invalid recipe id.",
                    });
                }

                const existingReport =
                    await reportsCollection.findOne({
                        recipeId: new ObjectId(report.recipeId),
                        reporterEmail: req.user.email,
                    });

                if (existingReport) {
                    return res.status(400).send({
                        message:
                            "You have already reported this recipe.",
                    });
                }

                report.recipeId = new ObjectId(report.recipeId);
                report.reporterEmail = req.user.email;
                report.createdAt = new Date();

                const result =
                    await reportsCollection.insertOne(report);

                res.send({
                    message: "Report submitted successfully.",
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
    return router;
}