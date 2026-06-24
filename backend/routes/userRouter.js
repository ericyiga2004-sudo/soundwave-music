import express from "express";

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

export default userRouter;