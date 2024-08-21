import mongoose from "mongoose";
import { DB_NAME } from "./../constant.js";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
    console.log("MongoDB connected Successfully");
  } catch (error) {
    console.error(error);
    console.log("MongoDB connection failed");
    process.exit(1);
  }
};

export default connectDB;
