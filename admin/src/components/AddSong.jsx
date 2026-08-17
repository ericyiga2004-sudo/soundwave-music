import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ADMIN_API_BASE_URL } from "../config/api";
import "./CSS/AddSong.css";

const backendUrl = ADMIN_API_BASE_URL;

const MAX_AUDIO_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const initialForm = {
  title: "",
  artist: "",
  album: "",
  genre: "",
  tags: "",
  mood: "",
  songLanguage: "",
  country: "",
  releaseDate: "",
  releaseYear: "",
  duration: "",
  lyrics: "",
  lrcLyrics: "",
  syncedLyrics: "",
  featured: false,
  explicit: false,
  status: "published",
};

const formatFileSize = (bytes) => {
  if (!bytes) return "0 MB";

  const mb = bytes / (1024 * 1024);

  return `${mb.toFixed(2)} MB`;
};

const AddSong = () => {
  const [form, setForm] = useState(initialForm);

  const [featuredArtists, setFeaturedArtists] = useState([]);
  const [audio, setAudio] = useState(null);
  const [image, setImage] = useState(null);

  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");

  const genres = [
    "Afrobeat",
    "Afrobeats",
    "Pop",
    "Hip Hop",
    "R&B",
    "Dancehall",
    "Amapiano",
    "Rock",
    "EDM",
    "Jazz",
    "Gospel",
    "Reggae",
    "Country",
    "Soul",
    "Unknown",
  ];

  const moods = [
    "Chill",
    "Party",
    "Sad",
    "Love",
    "Workout",
    "Worship",
    "Focus",
    "Happy",
    "Road Trip",
    "Dance",
    "Unknown",
  ];

  const languages = [
    "English",
    "Luganda",
    "Swahili",
    "French",
    "Spanish",
    "Arabic",
    "Yoruba",
    "Pidgin",
    "Zulu",
    "Unknown",
  ];

  const countries = [
    "Uganda",
    "Kenya",
    "Tanzania",
    "Rwanda",
    "Nigeria",
    "Ghana",
    "South Africa",
    "United States",
    "United Kingdom",
    "Jamaica",
    "Unknown",
  ];

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/artists`);

        if (res.data.success) {
          setArtists(res.data.artists || []);
        }
      } catch (err) {
        console.log(err);
        setMessage("Could not fetch artists");
      }
    };

    fetchArtists();
  }, []);

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/albums`);

        if (res.data.success) {
          setAlbums(res.data.albums || []);
        }
      } catch (err) {
        console.log(err);
        setMessage("Could not fetch albums");
      }
    };

    fetchAlbums();
  }, []);

  const selectedArtist = useMemo(() => {
    return artists.find((artist) => artist._id === form.artist);
  }, [artists, form.artist]);

  const filteredAlbums = useMemo(() => {
    return albums.filter((album) => album.artist?._id === form.artist);
  }, [albums, form.artist]);

  const availableFeaturedArtists = useMemo(() => {
    return artists.filter((artist) => artist._id !== form.artist);
  }, [artists, form.artist]);

  const selectedFeaturedArtists = useMemo(() => {
    return artists.filter((artist) => featuredArtists.includes(artist._id));
  }, [artists, featuredArtists]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => {
      const nextForm = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "releaseDate" && value) {
        const year = new Date(value).getFullYear();

        if (!Number.isNaN(year)) {
          nextForm.releaseYear = String(year);
        }
      }

      return nextForm;
    });
  };

  const handleArtistChange = (e) => {
    const artistId = e.target.value;
    const artist = artists.find((item) => item._id === artistId);

    setForm((prev) => ({
      ...prev,
      artist: artistId,
      album: "",
      country: prev.country || artist?.country || "",
    }));

    setFeaturedArtists((prev) => prev.filter((id) => id !== artistId));
  };

  const toggleFeaturedArtist = (artistId) => {
    setFeaturedArtists((prev) => {
      if (prev.includes(artistId)) {
        return prev.filter((id) => id !== artistId);
      }

      return [...prev, artistId];
    });
  };

  const handleAudioChange = (e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setAudio(null);
      return;
    }

    if (!file.type.startsWith("audio/")) {
      setMessage("Please select a valid audio file");
      e.target.value = "";
      setAudio(null);
      return;
    }

    if (file.size > MAX_AUDIO_SIZE) {
      setMessage("Audio file is too large. Maximum size is 30MB");
      e.target.value = "";
      setAudio(null);
      return;
    }

    setMessage("");
    setAudio(file);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setImage(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("Please select a valid image file");
      e.target.value = "";
      setImage(null);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setMessage("Image file is too large. Maximum size is 10MB");
      e.target.value = "";
      setImage(null);
      return;
    }

    setMessage("");
    setImage(file);
  };

  const resetForm = () => {
    setForm(initialForm);
    setFeaturedArtists([]);
    setAudio(null);
    setImage(null);
    setUploadProgress(0);
    setUploadStage("");

    const audioInput = document.getElementById("song-audio-file");
    const imageInput = document.getElementById("song-image-file");

    if (audioInput) audioInput.value = "";
    if (imageInput) imageInput.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!form.title.trim() || !form.artist || !form.album || !audio || !image) {
      setMessage("Please fill all required fields");
      return;
    }

    if (audio.size > MAX_AUDIO_SIZE) {
      setMessage("Audio file is too large. Maximum size is 30MB");
      return;
    }

    if (image.size > MAX_IMAGE_SIZE) {
      setMessage("Image file is too large. Maximum size is 10MB");
      return;
    }

    try {
      setLoading(true);
      setMessage("Preparing upload...");
      setUploadStage("Preparing upload...");
      setUploadProgress(0);

      const formData = new FormData();

      formData.append("title", form.title.trim());
      formData.append("artist", form.artist);
      formData.append("album", form.album);
      formData.append("genre", form.genre || "Unknown");
      formData.append("tags", form.tags);
      formData.append("mood", form.mood || "Unknown");
      formData.append("songLanguage", form.songLanguage || "Unknown");
      formData.append(
        "country",
        form.country || selectedArtist?.country || "Unknown"
      );
      formData.append("releaseDate", form.releaseDate);
      formData.append("releaseYear", form.releaseYear);
      formData.append("duration", form.duration || 0);

      formData.append("lyrics", form.lyrics);
      formData.append("lrcLyrics", form.lrcLyrics);
      formData.append("syncedLyrics", form.syncedLyrics);

      formData.append("featured", String(form.featured));
      formData.append("explicit", String(form.explicit));
      formData.append("status", form.status || "published");

      featuredArtists.forEach((artistId) => {
        formData.append("featuredArtists", artistId);
      });

      formData.append("audio", audio);
      formData.append("image", image);

      const res = await axios.post(
        `${backendUrl}/api/songs/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 0,

          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return;

            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );

            setUploadProgress(percent);

            if (percent < 100) {
              const text = `Uploading to server... ${percent}%`;
              setMessage(text);
              setUploadStage(text);
            } else {
              const text =
                "Files reached server. Uploading to Cloudinary and saving song...";
              setMessage(text);
              setUploadStage(text);
            }
          },
        }
      );

      if (res.data.success) {
        setMessage("Song uploaded successfully 🎧");
        setUploadStage("Song uploaded successfully");
        resetForm();
      } else {
        setMessage(res.data.message || "Upload failed");
        setUploadStage("");
      }
    } catch (err) {
      console.log(err);

      if (err.code === "ECONNABORTED") {
        setMessage("Upload timed out. Try again or check your server timeout.");
      } else if (err.message === "Network Error") {
        setMessage(
          "Network error. The request may have been aborted or the backend is unreachable."
        );
      } else {
        setMessage(err.response?.data?.message || "Upload failed");
      }

      setUploadStage("");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="add-song-container">
      <div className="add-song-header">
        <span>Admin Studio</span>
        <h2>🎧 Upload Song</h2>
        <p>
          Add full song metadata for filtering, charts, oldies, monthly recaps,
          countries, featured artists, and timed lyrics.
        </p>
      </div>

      {message && <p className="msg">{message}</p>}

      {loading && (
        <div className="upload-progress-wrap">
          <div className="upload-progress-bar">
            <div
              className="upload-progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>

          <p className="helper-text">
            {uploadProgress < 100
              ? `Uploading files to server... ${uploadProgress}%`
              : "Files reached server. Cloudinary upload is processing..."}
          </p>

          {uploadStage && <p className="helper-text">{uploadStage}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="song-form">
        <div className="form-section">
          <h3>Basic Details</h3>

          <input
            name="title"
            placeholder="Song title *"
            value={form.title}
            onChange={handleChange}
            disabled={loading}
          />

          <div className="form-grid">
            <select
              name="artist"
              value={form.artist}
              onChange={handleArtistChange}
              disabled={loading}
            >
              <option value="">Select Artist *</option>

              {artists.map((artist) => (
                <option key={artist._id} value={artist._id}>
                  {artist.name}
                </option>
              ))}
            </select>

            <select
              name="album"
              value={form.album}
              onChange={handleChange}
              disabled={!form.artist || loading}
            >
              <option value="">Select Album *</option>

              {filteredAlbums.map((album) => (
                <option key={album._id} value={album._id}>
                  {album.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-section">
          <h3>Discovery Metadata</h3>

          <div className="form-grid">
            <select
              name="genre"
              value={form.genre}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">Select Genre</option>

              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>

            <select
              name="mood"
              value={form.mood}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">Select Mood</option>

              {moods.map((mood) => (
                <option key={mood} value={mood}>
                  {mood}
                </option>
              ))}
            </select>

            <select
              name="songLanguage"
              value={form.songLanguage}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">Select Language</option>

              {languages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>

            <select
              name="country"
              value={form.country}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">Select Country</option>

              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          <input
            name="tags"
            placeholder="Tags: love, chill, summer, workout"
            value={form.tags}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="form-section">
          <h3>Release Info</h3>

          <div className="form-grid">
            <div className="input-block">
              <label>Release Date</label>
              <input
                type="date"
                name="releaseDate"
                value={form.releaseDate}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="input-block">
              <label>Release Year</label>
              <input
                type="number"
                name="releaseYear"
                min="1900"
                max="2100"
                placeholder="Example: 2024"
                value={form.releaseYear}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="input-block">
              <label>Duration in seconds</label>
              <input
                type="number"
                name="duration"
                min="0"
                placeholder="Example: 215"
                value={form.duration}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="input-block">
              <label>Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section lyrics-admin-section">
          <h3>Lyrics</h3>

          <div className="input-block">
            <label>Plain Lyrics</label>
            <textarea
              name="lyrics"
              placeholder="Paste normal lyrics here..."
              value={form.lyrics}
              onChange={handleChange}
              rows="8"
              disabled={loading}
            />
            <p className="helper-text">
              This is the fallback text shown when timed lyrics are missing.
            </p>
          </div>

          <div className="input-block">
            <label>Timed Lyrics - LRC Format</label>
            <textarea
              name="lrcLyrics"
              placeholder={`Example:
[00:12.30] I found a love for me
[00:17.80] Darling just dive right in
[00:22.40] And follow my lead`}
              value={form.lrcLyrics}
              onChange={handleChange}
              rows="8"
              disabled={loading}
            />
            <p className="helper-text">
              Use this for line-by-line highlighting while the song plays.
            </p>
          </div>

          <div className="input-block">
            <label>Word Synced Lyrics JSON Optional</label>
            <textarea
              name="syncedLyrics"
              placeholder={`Example:
[
  {
    "text": "I found a love for me",
    "start": 12.3,
    "end": 17.2,
    "words": [
      { "text": "I", "start": 12.3, "end": 12.55 },
      { "text": "found", "start": 12.55, "end": 12.9 },
      { "text": "a", "start": 12.9, "end": 13.05 },
      { "text": "love", "start": 13.05, "end": 13.5 },
      { "text": "for", "start": 13.5, "end": 13.8 },
      { "text": "me", "start": 13.8, "end": 14.2 }
    ]
  }
]`}
              value={form.syncedLyrics}
              onChange={handleChange}
              rows="12"
              disabled={loading}
            />
            <p className="helper-text">
              Leave this empty unless you have exact word-by-word timestamps.
            </p>
          </div>
        </div>

        <div className="form-section">
          <h3>Featured Artists</h3>

          {availableFeaturedArtists.length > 0 ? (
            <>
              <div className="featured-artist-grid">
                {availableFeaturedArtists.map((artist) => {
                  const selected = featuredArtists.includes(artist._id);

                  return (
                    <button
                      type="button"
                      key={artist._id}
                      className={
                        selected
                          ? "featured-artist-chip selected"
                          : "featured-artist-chip"
                      }
                      onClick={() => toggleFeaturedArtist(artist._id)}
                      disabled={loading}
                    >
                      {artist.name}
                    </button>
                  );
                })}
              </div>

              {selectedFeaturedArtists.length > 0 && (
                <p className="selected-featured">
                  Featuring:{" "}
                  {selectedFeaturedArtists
                    .map((artist) => artist.name)
                    .join(", ")}
                </p>
              )}
            </>
          ) : (
            <p className="helper-text">
              Select the main artist first, then choose featured artists.
            </p>
          )}
        </div>

        <div className="form-section">
          <h3>Flags</h3>

          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                name="featured"
                checked={form.featured}
                onChange={handleChange}
                disabled={loading}
              />
              Featured song
            </label>

            <label>
              <input
                type="checkbox"
                name="explicit"
                checked={form.explicit}
                onChange={handleChange}
                disabled={loading}
              />
              Explicit lyrics
            </label>
          </div>
        </div>

        <div className="form-section">
          <h3>Files</h3>

          <div className="file-grid">
            <div className="input-block">
              <label>Audio File *</label>
              <input
                id="song-audio-file"
                type="file"
                accept="audio/*"
                onChange={handleAudioChange}
                disabled={loading}
              />

              {audio && (
                <p className="helper-text">
                  Selected: {audio.name} ({formatFileSize(audio.size)})
                </p>
              )}
            </div>

            <div className="input-block">
              <label>Cover Image *</label>
              <input
                id="song-image-file"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={loading}
              />

              {image && (
                <p className="helper-text">
                  Selected: {image.name} ({formatFileSize(image.size)})
                </p>
              )}
            </div>
          </div>
        </div>

        <button className="submit-song-btn" disabled={loading}>
          {loading
            ? uploadProgress < 100
              ? `Uploading... ${uploadProgress}%`
              : "Processing..."
            : "Upload Song"}
        </button>
      </form>
    </div>
  );
};

export default AddSong;