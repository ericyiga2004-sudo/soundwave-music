import { LogIn, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AccountRequired = ({
  title = "Sign in to use SoundWave Social",
  message = "Listening stays open to everyone. An account is required for following people, commenting, reactions, Circles, daily picks, Friend Mix and live rooms.",
}) => {
  const navigate = useNavigate();
  return (
    <section className="sw-account-required" aria-label="Account required">
      <div className="sw-account-required-icon"><UsersRound size={28} /></div>
      <div>
        <span className="sw-social-kicker">SoundWave Social</span>
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
      <button type="button" className="sw-primary-btn" onClick={() => navigate("/account")}>
        <LogIn size={17} /> Sign in or create account
      </button>
    </section>
  );
};

export default AccountRequired;
