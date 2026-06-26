const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function connectDB() {
    await client.connect();

    console.log("MongoDB Connected Successfully");

    const db = client.db("recipehub");

    return {
        client,
        db,

        usersCollection: db.collection("user"),
        recipesCollection: db.collection("recipes"),
        favoritesCollection: db.collection("favorites"),
        reportsCollection: db.collection("reports"),
        paymentsCollection: db.collection("payments"),
    };
}

module.exports = connectDB;