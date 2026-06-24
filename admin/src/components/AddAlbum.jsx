import React, { useState, useEffect } from "react";
import axios from "axios";
import "./CSS/AddAlbum.css";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const AddAlbum = () => {
  const [form, setForm] = useState({
    title: "",
    artist: "",
    description: "",
  });

  const [cover, setCover] = useState(null);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // FETCH ARTISTS
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/artists`);
        if (res.data.success) {
          setArtists(res.data.artists);
        }
      } catch (err) {
        console.log("Failed to load artists", err);
      }
    };

    fetchArtists();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title || !form.artist || !cover) {
      setMessage("Title, artist and cover are required");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("artist", form.artist);
      formData.append("description", form.description);
      formData.append("coverImage", cover);

      const res = await axios.post(
        `${backendUrl}/api/albums`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (res.data.success) {
        setMessage("Album created successfully 💿");

        setForm({
          title: "",
          artist: "",
          description: "",
        });

        setCover(null);
      } else {
        setMessage(res.data.message);
      }
    } catch (err) {
      console.log(err);
      setMessage(err.response?.data?.message || "Error creating album");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-form album-form">

      <h2>💿 Create Album</h2>

      {message && <p className="msg">{message}</p>}

      <form onSubmit={handleSubmit}>

        <input
          name="title"
          placeholder="Album title"
          value={form.title}
          onChange={handleChange}
        />

        {/* ARTIST SELECT */}
        <select
          name="artist"
          value={form.artist}
          onChange={handleChange}
        >
          <option value="">Select Artist</option>

          {artists.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name} {a.country ? `(${a.country})` : ""}
            </option>
          ))}
        </select>

        <textarea
          name="description"
          placeholder="Album description"
          value={form.description}
          onChange={handleChange}
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setCover(e.target.files[0])}
        />

        <button disabled={loading}>
          {loading ? "Creating..." : "Create Album"}
        </button>

      </form>

    </div>
  );
};

export default AddAlbum;