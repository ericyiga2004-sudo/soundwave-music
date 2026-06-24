import express from "express";

import authUser from "../middleware/authUser.js";

import {
  addToHistory,
  getHistory,
} from "../controllers/historyController.js";

const historyRouter = express.Router();

historyRouter.post(
  "/add",
  authUser,
  addToHistory
);

historyRouter.get(
  "/get",
  authUser,
  getHistory
);

export default historyRouter;