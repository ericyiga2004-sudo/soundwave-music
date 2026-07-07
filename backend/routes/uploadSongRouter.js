import express from "express";
import {
  uploadSong,
  getSongs,
  getSongById,
  searchSongs,
  incrementPlays,
  deleteSong,

  // Discovery
  getTrendingSongs,
  getNewReleases,
  getPopularArtists,
  getArtistsByCountry,
  getMostLikedSongs,

  // Advanced filters
  filterSongs,
  getFilterOptions,
  getTopSongsByCountry,
  getSongsByYear,
  getOldSongs,
  getMonthlyRecap,
  getSongsFeaturingArtist,
  getTopTenSongs,
  updateTopTenSong,
} from "../controllers/uploadSongController.js";

import { songUpload } from "../middleware/multer.js";

const router = express.Router();

/* =========================
   SONG UPLOAD
========================= */
router.post(
  "/upload",
  songUpload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  uploadSong
);

// Admin-selected Top Ten songs
// Example: /api/songs/top-ten?country=Uganda
router.get("/top-ten", getTopTenSongs);

// Admin marks/removes a song as Top Ten
// Example: PATCH /api/songs/SONG_ID/top-ten
router.patch("/:id/top-ten", updateTopTenSong);

/* =========================
   SEARCH + FILTER ROUTES
   Keep these before /:id
========================= */

// Search songs
router.get("/search", searchSongs);

// Advanced filter
// Example:
// /api/songs/filter?country=Uganda&genre=Afrobeats&sort=popular
router.get("/filter", filterSongs);

// Filter options for frontend dropdowns
router.get("/filter-options", getFilterOptions);

/* =========================
   DISCOVERY ROUTES
   Keep these before /:id
========================= */

// Most liked songs
router.get("/most-liked/all", getMostLikedSongs);

// Trending songs by plays + likes
router.get("/trending/all", getTrendingSongs);

// New releases
router.get("/new-releases/all", getNewReleases);

// Top 100 songs by country
// Example: /api/songs/top-country/Uganda
router.get("/top-country/:country", getTopSongsByCountry);

// Songs by release year
// Example: /api/songs/year/2008
router.get("/year/:year", getSongsByYear);

// Old songs
// Example: /api/songs/oldies?before=2010
router.get("/oldies", getOldSongs);

// Monthly recap
// Example: /api/songs/monthly-recap?month=2026-06&country=Uganda
router.get("/monthly-recap", getMonthlyRecap);

// Songs where artist appears as featured artist
// Example: /api/songs/featuring/ARTIST_ID
router.get("/featuring/:artistId", getSongsFeaturingArtist);

/* =========================
   ARTIST DISCOVERY ROUTES
   Keep before /:id
========================= */

// Popular artists
router.get("/artists/popular", getPopularArtists);

// Artists by country
router.get("/artists/country/:country", getArtistsByCountry);

/* =========================
   BASIC SONG ROUTES
========================= */

// Get all songs
// Also supports filters now if your controller was updated:
// /api/songs?country=Uganda&sort=popular
router.get("/", getSongs);

// Get single song
router.get("/:id", getSongById);

// Increment plays
router.patch("/:id/play", incrementPlays);

// Delete song
router.delete("/:id", deleteSong);

export default router;