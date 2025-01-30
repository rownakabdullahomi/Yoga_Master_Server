const express = require('express');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 5000;


app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
    res.send("Hello from Yoga Master");
})

app.listen(port, ()=>{
    console.log(`Yoga Master listening on port: ${port}`);
})