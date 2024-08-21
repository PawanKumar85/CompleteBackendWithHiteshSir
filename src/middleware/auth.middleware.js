import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.js";
import User from "./../models/user.model.js";
const verifyJWT = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    if (!token) throw new ApiError(401, "Unauthorizated request");

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) throw new ApiError(401, "Unauthorizated request");
    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({
        message: "Invalid token",
        data: error?.message || "Server Side Error",
      });
  }
};

export { verifyJWT };
