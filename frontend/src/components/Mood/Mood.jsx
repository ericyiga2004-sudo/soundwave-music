import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSmile,
  FaFire,
  FaMoon,
  FaHeart,
  FaDumbbell,
  FaCloudRain,
  FaLeaf,
  FaBolt,
} from "react-icons/fa";
import "./Mood.css";

const moods = [
  {
    name: "Happy",
    slug: "happy",
    subtitle: "Bright songs for good energy",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    icon: <FaSmile />,
  },
  {
    name: "Party",
    slug: "party",
    subtitle: "Turn the volume up",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
    icon: <FaFire />,
  },
  {
    name: "Chill",
    slug: "chill",
    subtitle: "Relax and slow down",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
    icon: <FaLeaf />,
  },
  {
    name: "Romantic",
    slug: "romantic",
    subtitle: "Love songs and soft vibes",
    image:
      "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=900&q=80",
    icon: <FaHeart />,
  },
  {
    name: "Workout",
    slug: "workout",
    subtitle: "Energy for training",
    image:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
    icon: <FaDumbbell />,
  },
  {
    name: "Sad",
    slug: "sad",
    subtitle: "Emotional songs for quiet moments",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
    icon: <FaCloudRain />,
  },
  {
    name: "Sleep",
    slug: "sleep",
    subtitle: "Calm sounds for the night",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
    icon: <FaMoon />,
  },
  {
    name: "Energy",
    slug: "energy",
    subtitle: "Fast songs to wake you up",
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80",
    icon: <FaBolt />,
  },
];

const Mood = () => {
  const navigate = useNavigate();

  return (
    <section className="mood-section">
      <div className="mood-header">
        <div>
          <span>FEEL THE MUSIC</span>
          <h2>Moods</h2>
        </div>

        <button type="button" onClick={() => navigate("/mood/happy")}>
          Explore
        </button>
      </div>

      <div className="mood-scroll-wrapper">
        <div className="mood-grid">
          {moods.map((mood) => (
            <article className="mood-card" key={mood.slug}>
              <img src={mood.image} alt={mood.name} />

              <div className="mood-overlay">
                <div className="mood-icon">{mood.icon}</div>

                <div>
                  <h3>{mood.name}</h3>
                  <p>{mood.subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/mood/${mood.slug}`, window.scrollTo(0,0)) }
                >
                  Open Mood
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Mood;