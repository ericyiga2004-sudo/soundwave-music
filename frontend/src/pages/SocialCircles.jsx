import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CirclePlus, Copy, UserPlus, UsersRound } from "lucide-react";
import { apiClient } from "../config/apiClient";
import { useSocialHome } from "../hooks/useSocialHome";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import SocialPageHero from "../components/Social/SocialPageHero";
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";

const SocialCircles = () => {
  const navigate = useNavigate();
  const { authToken, headers, home, loading, realtimeConnected, invalidateSocial } = useSocialHome();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");

  if (!authToken) return <div className="sw-social-page"><AccountRequired title="Sign in to use Sound Circles" /></div>;
  if (loading && !home) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;

  const create = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) return setStatus("Give the Circle a name.");
    setBusy("create");
    try {
      const { data } = await apiClient.post("/api/social/circles", { name: name.trim(), description: description.trim() }, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not create Circle");
      invalidateSocial("circle-create", { circleId: data.circle._id });
      navigate(`/social/circles/${data.circle._id}`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error.message || "Could not create Circle.");
    } finally {
      setBusy("");
    }
  };

  const join = async (event) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy("join");
    try {
      const { data } = await apiClient.post("/api/social/circles/join", { code: code.trim().toUpperCase() }, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not join Circle");
      invalidateSocial("circle-join", { circleId: data.circleId });
      navigate(`/social/circles/${data.circleId}`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error.message || "Could not join Circle.");
    } finally {
      setBusy("");
    }
  };

  const copy = async (inviteCode) => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setStatus("Invite code copied.");
    } catch {
      setStatus(`Invite code: ${inviteCode}`);
    }
  };

  return (
    <div className="sw-social-page sw20-page container-fluid px-0">
      <SocialPageHero
        kicker="Private groups"
        title="Small music groups, without the noise."
        description="Circles are private spaces for close friends. Share tracks, leave notes and get live updates when someone adds something new."
        image={SOCIAL_IMAGES.circles}
        live={realtimeConnected}
      />

      <div className="row g-3 g-xl-4">
        <div className="col-12 col-xl-8">
          <section className="sw-social-panel sw20-panel">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Your Circles</span><h2>Private spaces</h2></div><UsersRound size={20} /></div>
            <div className="sw20-circle-grid">
              {(home?.circles || []).map((circle) => (
                <article key={circle._id} className="sw20-circle-card">
                  <button type="button" className="sw20-circle-main" onClick={() => navigate(`/social/circles/${circle._id}`)}>
                    <span className="sw20-circle-mark"><UsersRound size={20} /></span>
                    <span><strong>{circle.name}</strong><small>{circle.description || "Private music Circle"}</small><em>{circle.members?.length || 1} members</em></span>
                    <ArrowRight size={17} />
                  </button>
                  <button type="button" className="sw-icon-button" onClick={() => copy(circle.inviteCode)} aria-label="Copy invite code"><Copy size={15} /></button>
                </article>
              ))}
              {!home?.circles?.length ? <div className="sw20-empty-card"><UsersRound size={25} /><strong>No Circles yet.</strong><p>Create one for your closest music people, or join with an invite code.</p></div> : null}
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-4">
          <section className="sw-social-panel sw20-panel">
            <div className="sw20-form-title"><CirclePlus size={18} /><div><strong>Create a Circle</strong><small>Private by default.</small></div></div>
            <form className="sw20-stack-form" onSubmit={create}>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Circle name" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 220))} placeholder="What is this group for?" rows={3} />
              <button type="submit" className="sw-primary-btn" disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create Circle"}</button>
            </form>
          </section>

          <section className="sw-social-panel sw20-panel mt-3">
            <div className="sw20-form-title"><UserPlus size={18} /><div><strong>Join a Circle</strong><small>Use the invite code a friend sent you.</small></div></div>
            <form className="sw20-inline-code" onSubmit={join}>
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Invite code" />
              <button type="submit" className="sw-secondary-btn" disabled={busy === "join"}>Join</button>
            </form>
          </section>
        </div>
      </div>
      {status ? <div className="sw-social-message mt-3">{status}</div> : null}
    </div>
  );
};

export default SocialCircles;
