import express from "express";
import authUser from "../middleware/authUser.js";

import {
  getHomeRecommendations,
} from "../controllers/recommendationController.js";

const recommendationRouter =
  express.Router();

recommendationRouter.get(
  "/home",
  authUser,
  getHomeRecommendations
);

export default recommendationRouter;