require("dotenv").config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

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
        app.post("/add-to-cart", async (req, res) => {
            const newCartItem = req.body;
            const result = await cartCollection.insertOne(newCartItem);
            res.send(result);
        })

        // get cart item by id
        app.get("/cart-item/:id", async (req, res) => {
            const id = req.params.id;
            const email = req.body.email;
            const query = { classId: id, email };
            const projection = { classId: 1 };
            const result = await cartCollection.findOne(query, { projection });
            res.send(result);
        })

        // get cart info by user email
        app.get("/cart/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const projection = { classId: 1 };
            const cartItems = await cartCollection.find(query, { projection }).toArray();
            const classIds = cartItems.map(item => new ObjectId(item.classId));
            const query2 = { _id: { $in: classIds } };
            const result = await classCollection.find(query2).toArray();
            res.send(result);
        })

        // delete a cart item
        app.delete("/delete-cart-item/:id", async (req, res) => {
            const id = req.params.id;
            const query = { classId: id };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        // Payments Route

        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price) * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "usd",
                payment_method_types: ["card"]
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        // post payment info to db
        app.post('/payment-info', async (req, res) => {
            const paymentInfo = req.body;
            const classesId = paymentInfo.classesId;
            const userEmail = paymentInfo.userEmail;
            const singleClassId = req.query.classId;
            let query;
            // const query = { classId: { $in: classesId } };
            if (singleClassId) {
                query = { classId: singleClassId, email: userEmail };
            } else {
                query = { classId: { $in: classesId } };
            }
            const classesQuery = { _id: { $in: classesId.map(id => new ObjectId(id)) } }
            const classes = await classesCollection.find(classesQuery).toArray();
            const newEnrolledData = {
                userEmail: userEmail,
                classesId: classesId.map(id => new ObjectId(id)),
                transactionId: paymentInfo.transactionId,
            }
            const updatedDoc = {
                $set: {
                    totalEnrolled: classes.reduce((total, current) => total + current.totalEnrolled, 0) + 1 || 0,
                    availableSeats: classes.reduce((total, current) => total + current.availableSeats, 0) - 1 || 0,
                }
            }
            // const updatedInstructor = await userCollection.find()
            const updatedResult = await classesCollection.updateMany(classesQuery, updatedDoc, { upsert: true });
            const enrolledResult = await enrolledCollection.insertOne(newEnrolledData);
            const deletedResult = await cartCollection.deleteMany(query);
            const paymentResult = await paymentCollection.insertOne(paymentInfo);
            res.send({ paymentResult, deletedResult, enrolledResult, updatedResult });
        })

        // payment history length
        app.get('/payment-history-length/:email', async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const total = await paymentCollection.countDocuments(query);
            res.send({ total });
        })

        // Enrollment Routes
        app.get("/popular-classes", async(req, res)=>{
            const result = await classCollection.find().sort({totalEnrolled: -1}).limit(6).toArray();
            res.send(result);
        })

        app.get("/popular-instructors", async(req, res)=>{
            const pipeline = [
                {
                    $group: {
                        _id: "$instructorEmail",
                        totalEnrolled: { $sum: "$totalEnrolled"}
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "email",
                        as: "instructor"
                    }
                },
                {
                    $projects:{
                        _id: 0,
                        instructor: {
                            $arrayElemAt: ["instructor", 0]
                        },
                        totalEnrolled: 1
                    }
                },
                {
                    $sort:{
                        totalEnrolled: -1
                    }
                },
                {
                    $limit: 6
                }
            ]
            const result= await classCollection.aggregate(pipeline).toArray();
            res.send(result);
        })

        // admin stats
        app.get("/admin-stats", async(req, res)=>{
            const approvedClasses = (await classCollection.find({status: "approved"}).toArray()).length;
            const pendingClasses = (await classCollection.find({status: "pending"}).toArray()).length;
            const instructor = (await userCollection.find({role: "instructor"}).toArray()).length;
            const totalClasses = (await classCollection.find().toArray()).length;
            const totalEnrolled = (await enrolledCollection.find().toArray()).length;

            const result = {
                approvedClasses,
                pendingClasses,
                instructor,
                totalClasses,
                totalEnrolled
            }
            res.send(result);
        })

        // instructor
        // get all instructor

        app.get("/instructors", async (req, res)=>{
            const result = await userCollection.find({role: "instructor"}).toArray();
        })

        // get 
        app.get("/enrolled-classes/:email", async(req, res)=>{
            const email = req.params.email;
            const query = {userEmail : email};
            const pipeline = [
                {
                    $match: query
                },
                {
                    $lookup:{
                        from: "classes",
                        localField: "classId",
                        foreignField: "_id",
                        as: "classes"
                    }
                },
                {
                    $unwind: "$classes"
                },
                {
                    $lookup:{
                        from: "users",
                        localField: "classes.instructorEmail",
                        foreignField: "email",
                        as: "instructor"
                    }
                }, 
                {
                    $project:{
                        _id: 0,
                        instructor: {
                            $arrayElemAt: ["$instructor", 0]
                        },
                        classes: 1
                    }
                }
            ];
            const result = await enrolledCollection.aggregate(pipeline).toArray();
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