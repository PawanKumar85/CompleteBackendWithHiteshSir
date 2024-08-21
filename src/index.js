import connectDB from "./config/database.config.js";
import dotenv from "dotenv";
import { app } from "./app.js";
dotenv.config();

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    console.log("Server Side Error");
  });
