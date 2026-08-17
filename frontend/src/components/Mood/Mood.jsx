import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaSmile, FaFire, FaMoon, FaHeart, FaDumbbell, FaCloudRain, FaLeaf, FaBolt } from "react-icons/fa";
import { getLowData, UI_PREFERENCES_EVENT } from "../../utils/uiPreferences";
import "./Mood.css";

const moods = [
  { name: "Happy", slug: "happy", subtitle: "Bright songs for good energy", image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=520&q=72", icon: FaSmile },
  { name: "Party", slug: "party", subtitle: "Turn the volume up", image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=520&q=72", icon: FaFire },
  { name: "Chill", slug: "chill", subtitle: "Relax and slow down", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=520&q=72", icon: FaLeaf },
  { name: "Romantic", slug: "romantic", subtitle: "Love songs and soft vibes", image: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=520&q=72", icon: FaHeart },
  { name: "Workout", slug: "workout", subtitle: "Energy for training", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=520&q=72", icon: FaDumbbell },
  { name: "Sad", slug: "sad", subtitle: "Emotional songs for quiet moments", image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=520&q=72", icon: FaCloudRain },
  { name: "Sleep", slug: "sleep", subtitle: "Calm sounds for the night", image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=520&q=72", icon: FaMoon },
  { name: "Energy", slug: "energy", subtitle: "Fast songs to wake you up", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=520&q=72", icon: FaBolt },
];

const Mood = () => {
  const navigate = useNavigate();
  const [lowData, setLowDataState] = useState(getLowData);

  useEffect(() => {
    const sync = () => setLowDataState(getLowData());
    window.addEventListener(UI_PREFERENCES_EVENT, sync);
    return () => window.removeEventListener(UI_PREFERENCES_EVENT, sync);
  }, []);

  return (
    <section className="mood-section">
      <div className="mood-header">
        <div>
          <span>Browse</span>
          <h2>Moods</h2>
        </div>
        <button type="button" onClick={() => navigate("/explore")}>See All</button>
      </div>

      <div className="mood-grid" role="list">
        {moods.map((mood) => {
          const Icon = mood.icon;
          return (
            <button
              type="button"
              className="mood-card"
              key={mood.slug}
              onClick={() => {
                navigate(`/mood/${mood.slug}`);
                window.scrollTo(0, 0);
              }}
              role="listitem"
              aria-label={`Open ${mood.name} mood`}
            >
              <span className="mood-artwork">
                {lowData ? (
                  <span className="mood-low-data-art"><Icon /></span>
                ) : (
                  <img src={mood.image} alt="" loading="lazy" decoding="async" />
                )}
              </span>
              <span className="mood-copy">
                <strong>{mood.name}</strong>
                <small>{mood.subtitle}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default Mood;
