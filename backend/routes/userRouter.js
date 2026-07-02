/* import express from "express";

import {
  registerUser,
  loginUser,
  getProfile,
} from "../controllers/userController.js";

import authUser from "../middleware/authUser.js";

const userRouter = express.Router();

// REGISTER
userRouter.post(
  "/register",
  registerUser
);

// LOGIN
userRouter.post(
  "/login",
  loginUser
);

// PROFILE
userRouter.get(
  "/profile",
  authUser,
  getProfile
);

export default userRouter; */

/* import express from "express";

import {
  registerUser,
  loginUser,
  getProfile,
  getRecommendations,
} from "../controllers/userController.js";

import authUser from "../middleware/authUser.js";

const userRouter = express.Router();

// =============================
// REGISTER
// =============================
userRouter.post(
  "/register",
  registerUser
);

// =============================
// LOGIN
// =============================
userRouter.post(
  "/login",
  loginUser
);

// =============================
// PROFILE
// =============================
userRouter.get(
  "/profile",
  authUser,
  getProfile
);

// =============================
// PERSONALIZED RECOMMENDATIONS
// =============================
userRouter.get(
  "/recommendations",
  authUser,
  getRecommendations
);

export default userRouter; */

/* import express from "express";

import {
  registerUser,
  loginUser,
  getProfile,
  getRecommendations,
  getBecauseYouLiked,
} from "../controllers/userController.js";

import authUser from "../middleware/authUser.js";

const userRouter = express.Router();

// REGISTER
userRouter.post("/register", registerUser);

// LOGIN
userRouter.post("/login", loginUser);

// PROFILE
userRouter.get("/profile", authUser, getProfile);

// PERSONALIZED RECOMMENDATIONS
userRouter.get("/recommendations", authUser, getRecommendations);

// BECAUSE YOU LIKED
userRouter.get("/because-you-liked", authUser, getBecauseYouLiked);

export default userRouter; */


import express from "express";

import {
  registerUser,
  loginUser,
  getProfile,
  getRecommendations,
  getBecauseYouLiked,
  saveUserLocation,
} from "../controllers/userController.js";

import authUser from "../middleware/authUser.js";

const userRouter = express.Router();

// REGISTER
userRouter.post("/register", registerUser);

// LOGIN
userRouter.post("/login", loginUser);

// PROFILE
userRouter.get("/profile", authUser, getProfile);

// PERSONALIZED RECOMMENDATIONS
userRouter.get("/recommendations", authUser, getRecommendations);

// BECAUSE YOU LIKED
userRouter.get("/because-you-liked", authUser, getBecauseYouLiked);

// SAVE USER LOCATION
userRouter.post("/location", authUser, saveUserLocation);

export default userRouter;