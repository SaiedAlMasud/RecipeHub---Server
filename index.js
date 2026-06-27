require("dotenv").config();

const verifyToken = require("./middleware/verifyToken");
const express = require("express");
const cors = require("cors");
const recipeRoutes = require("./routes/recipeRoutes");
const connectDB = require("./config/db");
const stripe = require("./config/stripe");
const favoriteRoutes = require("./routes/favoriteRoutes");
const profileRoutes = require("./routes/profileRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const verifyAdmin = require("./middleware/verifyAdmin");

const app = express();
const port = process.env.PORT || 5000;
// Middleware
app.use(cors());
app.use(express.json());

async function run() {
    try {
        const {
            usersCollection,
            recipesCollection,
            favoritesCollection,
            reportsCollection,
            paymentsCollection,
        } = await connectDB();

        const adminMiddleware = verifyAdmin(usersCollection);
        //recipe apis
        app.use(
            "/recipes",
            recipeRoutes(
                recipesCollection,
                verifyToken
            )
        );

        //favorite recipe apis
        app.use(
            "/favorites",
            favoriteRoutes(
                favoritesCollection,
                recipesCollection,
                verifyToken
            )
        );

        //profile api
        app.use(
            "/profile",
            profileRoutes(
                usersCollection,
                verifyToken
            )
        );

        //payment apis
        app.use(
            "/",
            paymentRoutes(
                stripe,
                paymentsCollection,
                usersCollection,
                recipesCollection,
                verifyToken
            )
        );

        //admin apis
        app.use(
            "/admin",
            adminRoutes(
                usersCollection,
                recipesCollection,
                reportsCollection,
                paymentsCollection,
                verifyToken,
                adminMiddleware
            )
        );


    } finally {
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});