module.exports = async (req, res, next) => {
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
                message: "Access denied.",
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