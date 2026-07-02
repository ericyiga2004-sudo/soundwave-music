/* import express from "express";
import { artistUpload } from "../middleware/multer.js";

import {
  createArtist,
  getArtists,
  getArtistById,
  updateArtist,
  deleteArtist,
} from "../controllers/artistController.js";

const artistRoutes = express.Router();

// Create Artist
artistRoutes.post(
  "/",
  artistUpload.single("image"),
  createArtist
);

// Get All Artists
artistRoutes.get("/", getArtists);

// Get Artist By ID
artistRoutes.get("/:id", getArtistById);

// Update Artist
artistRoutes.put(
  "/:id",
  artistUpload.single("image"),
  updateArtist
);

// Delete Artist
artistRoutes.delete("/:id", deleteArtist);

export default artistRoutes; */


import express from "express";
import { artistUpload } from "../middleware/multer.js";
import authUser from "../middleware/authUser.js";

import {
  createArtist,
  getArtists,
  getArtistById,
  updateArtist,
  deleteArtist,
  toggleFollowArtist,
  checkArtistFollowed,
  getFollowedArtists,
} from "../controllers/artistController.js";

const artistRoutes = express.Router();

// Create Artist
artistRoutes.post(
  "/",
  artistUpload.single("image"),
  createArtist
);

// Get All Artists
artistRoutes.get("/", getArtists);

// Get Followed Artists
artistRoutes.get(
  "/following",
  authUser,
  getFollowedArtists
);

// Check Artist Followed
artistRoutes.get(
  "/check-follow/:artistId",
  authUser,
  checkArtistFollowed
);

// Toggle Follow Artist
artistRoutes.post(
  "/follow/:artistId",
  authUser,
  toggleFollowArtist
);

// Get Artist By ID
artistRoutes.get("/:id", getArtistById);

// Update Artist
artistRoutes.put(
  "/:id",
  artistUpload.single("image"),
  updateArtist
);

// Delete Artist
artistRoutes.delete("/:id", deleteArtist);

export default artistRoutes;