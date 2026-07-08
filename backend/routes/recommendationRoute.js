import express from "express";
import authUser from "../middleware/authUser.js";

import {
  getArtistRecommendations,
  getDiscoverRecommendations,
  getForYouRecommendations,
  getHistoryBasedRecommendations,
  getHomeRecommendations,
  getLikedBasedRecommendations,
  getMostLikedRecommendations,
  getNewReleaseRecommendations,
  getPreferenceSummary,
  getSingleYearRecommendations,
  getTrendingRecommendations,
  getYearRecommendations,
} from "../controllers/recommendationController.js";

const recommendationRouter = express.Router();

recommendationRouter.get("/home", authUser, getHomeRecommendations);

recommendationRouter.get("/for-you", authUser, getForYouRecommendations);

recommendationRouter.get("/trending", authUser, getTrendingRecommendations);

recommendationRouter.get(
  "/new-releases",
  authUser,
  getNewReleaseRecommendations
);

recommendationRouter.get("/most-liked", authUser, getMostLikedRecommendations);

recommendationRouter.get("/artists", authUser, getArtistRecommendations);

recommendationRouter.get("/years", authUser, getYearRecommendations);

recommendationRouter.get("/year/:year", authUser, getSingleYearRecommendations);

recommendationRouter.get("/discover", authUser, getDiscoverRecommendations);

recommendationRouter.get("/liked", authUser, getLikedBasedRecommendations);

recommendationRouter.get("/history", authUser, getHistoryBasedRecommendations);

recommendationRouter.get("/preferences", authUser, getPreferenceSummary);

export default recommendationRouter;