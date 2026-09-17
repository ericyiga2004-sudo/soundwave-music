import express from "express";
import {
  getAudiusAlbumById,
  getAudiusArtist,
  getAudiusArtists,
  getAudiusCatalog,
  getAudiusStatus,
  searchAudius,
  streamAudiusTrack,
} from "../controllers/audiusController.js";

const router = express.Router();
router.get("/status", getAudiusStatus);
router.get("/catalog", getAudiusCatalog);
router.get("/search", searchAudius);
router.get("/artists", getAudiusArtists);
router.get("/artists/:artistId", getAudiusArtist);
router.get("/albums/:albumId", getAudiusAlbumById);
router.get("/stream/:trackId", streamAudiusTrack);
export default router;
