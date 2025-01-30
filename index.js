require("dotenv").config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));


const uri = process.env.DB_CONNECTION_STRING;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        const userCollection = client.db("yogaMasterDB").collection("users");
        const classCollection = client.db("yogaMasterDB").collection("classes");
        const cartCollection = client.db("yogaMasterDB").collection("cart");
        const paymentCollection = client.db("yogaMasterDB").collection("payments");
        const enrolledCollection = client.db("yogaMasterDB").collection("enrolled");
        const ordersCollection = client.db("yogaMasterDB").collection("orders");
        const appliedCollection = client.db("yogaMasterDB").collection("applied");

        // classes routes
        // post a class
        app.post("/new-class", async (req, res) => {
            const newClass = req.body;
            const result = await classCollection.insertOne(newClass);
            res.send(result);
        })
        // get all classes
        app.get("/all/classes", async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result);
        })
        // get a single class by id
        app.get("/class/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classCollection.findOne(query);
            res.send(result);
        })
        // get classes based on status
        app.get("/approved/classes", async (req, res) => {
            const query = { status: "approved" };
            const result = await classCollection.find(query).toArray();
            res.send(result);
        })
        // get classes by an instructor's email
        app.get("/classes/:email", async (req, res) => {
            const email = req.params.email;
            const query = { instructorEmail: email };
            const result = await classCollection.find(query).toArray();
            res.send(result);
        })

        // update status and reason of a class
        app.patch("/change-status/:id", async (req, res) => {
            const id = req.params.id;
            const { status, reason } = req.body;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status,
                    reason
                }
            }
            const result = await classCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        // update a class
        app.put("/update-class/:id", async (req, res) => {
            const id = req.params.id;
            const { name, description, price, availableSeats, videoLink } = req.body;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name,
                    description,
                    price,
                    availableSeats,
                    videoLink,
                    status: "pending",
                }
            }
            const result = await classCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        // Cart Routes--------------------
        // post a cart
        app.post("/add-to-cart", async(req, res)=>{
            const newCartItem = req.body;
            const result = await cartCollection.insertOne(newCartItem);
            res.send(result);
        })

        // get cart item by id
        app.get("/cart-item/:id", async(req, res)=>{
            const id = req. params.id;
            const email = req.body.email;
            const query = { classId: id, email };
            const projection = {classId: 1};
            const result = await cartCollection.findOne(query, {projection});
            res.send(result);
        })










        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get("/", (req, res) => {
    res.send("Hello from Yoga Master");
})

app.listen(port, () => {
    console.log(`Yoga Master listening on port: ${port}`);
})