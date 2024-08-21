import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import User from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({
      validateBeforeSave: false,
    });

    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    throw new ApiError(500, error?.message || "Server Side Error");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  try {
    const { fullName, email, password, userName } = req.body;

    if (
      [fullName, email, password, userName].some(
        (field) => field?.trim() === ""
      )
    ) {
      throw new ApiError(400, "All fiels are required");
    }

    const existing = await User.findOne({
      $or: [{ email }, { userName }],
    });

    if (existing) {
      throw new ApiError(409, "Email/UserName is already exist");
    }

    const avatarLocal = req.files?.avatar[0]?.path;
    // const coverImageLocal = req.files?.coverImage[0]?.path;

    let coverImageLocal;
    if (
      req.files &&
      Array.isArray(req.files.coverImage) &&
      req.files.coverImage.length > 0
    ) {
      coverImageLocal = req.files.coverImage[0].path;
    }

    const avatarUploaded = await uploadOnCloudinary(avatarLocal);
    const coverImageUploaded = await uploadOnCloudinary(coverImageLocal);

    const newUser = await User.create({
      fullName,
      avatar: avatarUploaded.url,
      coverImage: coverImageUploaded?.url || "",
      email,
      password,
      userName: userName.toLowerCase(),
    });

    const checkUser = await User.findById(newUser._id).select(
      "-password -refreshToken"
    );
    if (!checkUser) throw new ApiError(500, "Server side error");
    return res.status(200).json({
      message: "User created successfully",
      user: checkUser,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      data: error.message,
    });
  }
});

const logInUser = asyncHandler(async (req, res) => {
  try {
    const { email, password, userName } = req.body;

    if (!email && !userName)
      throw new ApiError(409, "Email and userName is required");

    const user = await User.findOne({
      $or: [{ email }, { userName: userName.toLowerCase() }],
    });

    if (!user) throw new ApiError(404, "User not found");

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) throw new ApiError(401, "Password incorrect");

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );
    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        message: "User logged in successfully",
        user: loggedInUser,
        accessToken,
        refreshToken,
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      data: error.message,
    });
  }
});

const logOutUser = asyncHandler(async (req, res) => {
  try {
    User.findByIdAndUpdate(
      req.user._id,
      {
        $unset: { refreshToken: 1 },
      },
      { new: true }
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json({
        message: "User logged out successfully",
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      data: error?.message || "Server Side Error",
    });
  }
});

const refressAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefressToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefressToken) throw new ApiError(401, "unauthorized token");
    const decodedToken = jwt.verify(
      incomingRefressToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) throw new ApiError(401, "invalid refresh Token");

    if (incomingRefressToken !== user?.refreshToken)
      throw new ApiError(401, "refresh token is expired or used");
    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newNefreshToken } =
      await generateAccessAndRefreshTokens(user._id);
    return res
      .status(200)
      .cookies("accessToken", accessToken, options)
      .cookies("refressToken", newNefreshToken, options)
      .json({
        message: "Access token generated successfully",
        accessToken,
        refreshToken: newNefreshToken,
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      data: error.message,
    });
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) throw new ApiError(400, "Invalid Password");

    user.password = newPassword;
    await user.save({
      validateBeforeSave: false,
    });
    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {}
});

const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    return res.status(200).json({
      message: "User data fetched successfully",
      user: req.user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      data: error.message,
    });
  }
});

const updateAccoundDetails = asyncHandler(async (req, res) => {
  try {
    const { fullName, email } = req.body;

    if (!fullName || !email) throw new ApiError(400, "All fields are required");
    const user = User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: [{ fullName }, { email }],
      },
      { new: true }
    ).select("-password");
    return res.status(200).json({
      message: "Account details updated successfully",
      user: user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      data: error.message,
    });
  }
});

const updateAvatar = asyncHandler(async (req, res) => {
  try {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) throw new ApiError(400, "Avatar file is missing");

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) throw new ApiError(400, "Error while uploading on Avatar");

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: { avatar: avatar.url },
      },
      { new: true }
    ).select("-password");

    return res.status(200).json({
      message: "Avatar updated successfully",
      data: user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      data: error.message,
    });
  }
});

const updateCoverImage = asyncHandler(async (req, res) => {
  try {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath)
      throw new ApiError(400, "CoverImage file is missing");

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url)
      throw new ApiError(400, "Error while uploading on Avatar");

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: { coverImage: coverImage.url },
      },
      { new: true }
    ).select("-password");

    return res.status(200).json({
      message: "coverImage updated successfully",
      data: user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      status: 500,
      data: error.message,
    });
  }
});

// const getUserChannelProfile = asyncHandler(async (req, res) => {
//   try {
//     const { userName } = req.params;

//     if (!userName?.trim()) throw new ApiError(400, "Username is missing");

//     const channel = await User.aggregate([
//       {
//         $match: {
//           userName: userName?.toLowerCase(),
//         },
//       },
//       {
//         $lookup: {
//           from: "subscriptions",
//           localField: "_id",
//           foreignField: "channel",
//           as: "subscribers",
//         },
//       },
//       {
//         $lookup: {
//           from: "subscriptions",
//           localField: "_id",
//           foreignField: "subscribers",
//           as: "subscribedTo",
//         },
//       },
//       {
//         $addFields: {
//           subscribersCount: {
//             $size: "$subscribers",
//           },
//           channelsToCount: {
//             $size: "$subscribedTo",
//           },
//           isSubscribed: {
//             $cond: {
//               if: { $in: [req.user?._id, "subscribers.subscriber"] },
//               then: true,
//               else: false,
//             },
//           },
//         },
//       },
//       {
//         $project: {
//           fullName: 1,
//           userName: 1,
//           subscribersCount: 1,
//           channelsToCount: 1,
//           isSubscribed: 1,
//           avatar: 1,
//           coverImage: 1,
//           email: 1,
//         },
//       },
//     ]);

//     if (!channel?.length) throw new ApiError(404, "channel does not exist");
//     console.log(channel);
//     res.status(200).json({
//       data: channel[0],
//       message: "User channel fetched Successfully",
//     });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({
//       message: error.message,
//       success: false,
//     });
//   }
// });

const getUserChannelProfile = asyncHandler(async (req, res) => {
  try {
    const { userName } = req.params;

    if (!userName?.trim()) {
      throw new ApiError(400, "Username is missing");
    }

    const channel = await User.aggregate([
      {
        $match: {
          userName: userName?.toLowerCase(),
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers",
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "subscribers",
          as: "subscribedTo",
        },
      },
      {
        $addFields: {
          subscribersCount: {
            $size: "$subscribers",
          },
          channelsToCount: {
            $size: "$subscribedTo",
          },
          isSubscribed: {
            $cond: {
              if: { $in: [req.user?._id, "$subscribers.subscriber"] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          fullName: 1,
          userName: 1,
          subscribersCount: 1,
          channelsToCount: 1,
          isSubscribed: 1,
          avatar: 1,
          coverImage: 1,
          email: 1,
        },
      },
    ]);

    if (!channel?.length) {
      throw new ApiError(404, "Channel does not exist");
    }

    res.status(200).json({
      data: channel[0],
      message: "User channel fetched successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});

const getWatchHistory = asyncHandler(async (req, res) => {
  try {
    const user = await User.aggregate([
      {
        $match: {
          _id: req.user._id,
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchHistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullName: 1,
                      avatar: 1,
                      userName: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                owner: {
                  $first: "$owner",
                },
              },
            },
          ],
        },
      },
    ]);

    console.log(user);
    return res.status(200).json({
      success: true,
      data: user[0].watchHistory,
      data: "watch History fetch Successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});

export {
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
};
