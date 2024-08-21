import express from "express";
import {
  registerUser,
  logInUser,
  logOutUser,
  refressAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccoundDetails,
  updateAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory,
} from "./../controller/user.controller.js";
import { upload } from "../middleware/multer.middleware.js";
import { verifyJWT } from "../middleware/auth.middleware.js";
const router = express.Router();

router
  .post(
    "/register",
    upload.fields([
      { name: "avatar", maxCount: 1 },
      { name: "coverImage", maxCount: 1 },
    ]),
    registerUser
  )
  .post("/login", logInUser)
  .post("/logout", verifyJWT, logOutUser)
  .post("/refresh-token", refressAccessToken)
  .post("/change-password", verifyJWT, changeCurrentPassword)
  .get("/current-user", verifyJWT, getCurrentUser)
  .patch("/update-account", verifyJWT, updateAccoundDetails)
  .patch("/avatar", verifyJWT, upload.single("avatar"), updateAvatar)
  .patch(
    "/coverImage",
    verifyJWT,
    upload.single("coverImage"),
    updateCoverImage
  )
  .get("/c/:userName", verifyJWT, getUserChannelProfile)
  .get("/watch-history", verifyJWT, getWatchHistory);

export default router;
