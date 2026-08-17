import express from "express";
import authUser from "../middleware/authUser.js";
import { recordPersonalizationEvents } from "../controllers/personalizationController.js";

const personalizationRouter = express.Router();
personalizationRouter.post("/interactions", authUser, recordPersonalizationEvents);
export default personalizationRouter;
