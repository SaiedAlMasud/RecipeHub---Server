module.exports = function (usersCollection) {
    return async (req, res, next) => {
        try {
            const user = await usersCollection.findOne({
                email: req.user.email,
            });

            if (!user) {
                return res.status(404).send({
                    message: "User not found.",
                });
            }

            if (user.role !== "admin") {
                return res.status(403).send({
                    message: "Access denied. Admin only.",
                });
            }

            next();
        } catch (error) {
            console.error(error);

            res.status(500).send({
                message: "Internal Server Error",
            });
        }
    };
};