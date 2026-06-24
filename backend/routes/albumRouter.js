import express from "express";
import { albumUpload } from "../middleware/multer.js";

import {
  createAlbum,
  getAlbums,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
} from "../controllers/albumController.js";

const albumRoutes = express.Router();

// Create Album
albumRoutes.post(
  "/",
  albumUpload.single("coverImage"),
  createAlbum
);

// Get All Albums
albumRoutes.get("/", getAlbums);

// Get Single Album
albumRoutes.get("/:id", getAlbumById);

// Update Album
albumRoutes.put(
  "/:id",
  albumUpload.single("coverImage"),
  updateAlbum
);

// Delete Album
albumRoutes.delete("/:id", deleteAlbum);

export default albumRoutes;