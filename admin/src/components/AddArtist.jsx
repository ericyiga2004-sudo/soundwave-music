import React, { useState } from "react";
import axios from "axios";
import { ADMIN_API_BASE_URL } from "../config/api";
import "./CSS/AddArtist.css";

const backendUrl = ADMIN_API_BASE_URL;

const AddArtist = () => {
  const [form, setForm] = useState({
    name: "",
    bio: "",
    country: "",
    followers: 0,
    verified: false,
  });

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !image) {
      setMessage("Name and image are required");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("bio", form.bio);
      formData.append("country", form.country);
      formData.append("followers", form.followers);
      formData.append("verified", form.verified);
      formData.append("image", image);

      const res = await axios.post(
        `${backendUrl}/api/artists`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (res.data.success) {
        setMessage("Artist created successfully 🎉");

        setForm({
          name: "",
          bio: "",
          country: "",
          followers: 0,
          verified: false,
        });

        setImage(null);
      } else {
        setMessage(res.data.message);
      }
    } catch (err) {
      console.log(err);
      setMessage("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="artist-page">
      <div className="artist-card">
        <h2>Create Artist</h2>

        <form onSubmit={handleSubmit} className="artist-form">

          <input
            name="name"
            type="text"
            placeholder="Artist name"
            value={form.name}
            onChange={handleChange}
          />

          <textarea
            name="bio"
            placeholder="Artist bio"
            value={form.bio}
            onChange={handleChange}
          />

          <input
            name="country"
            type="text"
            placeholder="Country (e.g Uganda, USA)"
            value={form.country}
            onChange={handleChange}
          />

          <input
            name="followers"
            type="number"
            placeholder="Followers"
            value={form.followers}
            onChange={handleChange}
          />

          <label className="checkbox">
            <input
              type="checkbox"
              name="verified"
              checked={form.verified}
              onChange={handleChange}
            />
            Verified Artist
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Uploading..." : "Create Artist"}
          </button>

        </form>

        {message && <p className="msg">{message}</p>}
      </div>
    </div>
  );
};

export default AddArtist;