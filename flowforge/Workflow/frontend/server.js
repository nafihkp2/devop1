const express = require("express");
const axios = require("axios");

const app = express();

app.get("/", async (req, res) => {
  try {
    const response = await axios.get("http://localhost:5000/api/message"); // Backend API call
    res.send(`<h1>Backend says:</h1><p>${response.data.message}</p>`);
  } catch (error) {
    res.status(500).send("Error connecting to backend");
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Frontend running on port ${PORT}`));
