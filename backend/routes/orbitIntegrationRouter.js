import express from "express";
import orbitConnectorAuth from "../middleware/orbitConnectorAuth.js";
import { songUpload, artistUpload, albumUpload } from "../middleware/multer.js";
import {
  uploadSong,
  getSongs,
} from "../controllers/uploadSongController.js";
import {
  createArtist,
  getArtists,
} from "../controllers/artistController.js";
import {
  createAlbum,
  getAlbums,
} from "../controllers/albumController.js";

const router = express.Router();

// Every route below is server-to-server only and requires ORBIT_CONNECTOR_KEY.
router.use(orbitConnectorAuth);

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "soundwave-orbit-connector",
    version: "1.0.0",
    status: "ready",
  });
});

router.get("/capabilities", (req, res) => {
  return res.status(200).json({
    success: true,
    connector: "soundwave",
    version: "1.0.0",
    capabilities: {
      artists: ["list", "create"],
      albums: ["list", "create"],
      songs: ["list", "upload"],
    },
    uploadFields: {
      artistImage: "image",
      albumCover: "coverImage",
      songAudio: "audio",
      songImage: "image",
      songLanguage: "songLanguage",
    },
  });
});

router.get("/artists", getArtists);
router.post("/artists", artistUpload.single("image"), createArtist);

router.get("/albums", getAlbums);
router.post("/albums", albumUpload.single("coverImage"), createAlbum);

router.get("/songs", getSongs);
router.post(
  "/songs",
  songUpload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  uploadSong
);

export default router;
