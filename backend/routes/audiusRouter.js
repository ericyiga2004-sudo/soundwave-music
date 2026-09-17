import express from "express";
import {
  getAudiusCatalog,
  getAudiusStatus,
  searchAudius,
  streamAudiusTrack,
} from "../controllers/audiusController.js";

const router = express.Router();

router.get("/status", getAudiusStatus);
router.get("/catalog", getAudiusCatalog);
router.get("/search", searchAudius);
router.get("/stream/:trackId", streamAudiusTrack);

export default router;
