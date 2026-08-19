import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Headphones, RadioTower, UsersRound, LogOut, Trash2 } from "lucide-react";
import { apiClient } from "../config/apiClient";
import { clearActiveLiveRoomSession } from "../utils/liveRoomSession";
import { useSocialHome } from "../hooks/useSocialHome";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import SocialPageHero from "../components/Social/SocialPageHero";
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";
import "./CSS/LiveRoomLifecycleV2322.css";

const SocialRooms = () => {
  const navigate = useNavigate();
  const { authToken, headers, home, loading, realtimeConnected, invalidateSocial } = useSocialHome();
  const [roomName, setRoomName] = useState("Pass the Aux");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [roomActionBusy, setRoomActionBusy] = useState("");

  if (!authToken) return <div className="sw-social-page"><AccountRequired title="Sign in to use Pass the Aux" /></div>;
  if (loading && !home) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;

  const create = async () => {
    setBusy("create");
    setStatus("");
    try {
      const { data } = await apiClient.post("/api/social/rooms", { name: roomName.trim() || "Pass the Aux" }, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not create room");
      invalidateSocial("room-create", { code: data.room.code });
      navigate(`/social/rooms/${data.room.code}`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error.message || "Could not create room.");
    } finally {
      setBusy("");
    }
  };

  const join = async (event) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy("join");
    setStatus("");
    try {
      const { data } = await apiClient.post("/api/social/rooms/join", { code: code.trim().toUpperCase() }, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not join room");
      invalidateSocial("room-join", { code: data.code });
      navigate(`/social/rooms/${data.code}`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error.message || "Could not join room.");
    } finally {
      setBusy("");
    }
  };

  const leaveRoom = async (event, room) => {
    event?.stopPropagation?.();
    if (!room?.code || roomActionBusy) return;
    const key = `leave:${room.code}`;
    setRoomActionBusy(key);
    setStatus("");
    try {
      const { data } = await apiClient.post(
        `/api/social/rooms/${room.code}/leave`,
        {},
        { headers }
      );
      if (!data?.success) throw new Error(data?.message || "Could not leave room");
      clearActiveLiveRoomSession(room.code);
      invalidateSocial("room-left", { code: room.code });
      setStatus(`Left ${room.name || room.code}.`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error.message || "Could not leave room.");
    } finally {
      setRoomActionBusy("");
    }
  };

  const deleteRoom = async (event, room) => {
    event?.stopPropagation?.();
    if (!room?.code || roomActionBusy) return;
    const approved = window.confirm(
      `Delete "${room.name || room.code}" permanently? Everyone will lose access to it.`
    );
    if (!approved) return;

    const key = `delete:${room.code}`;
    setRoomActionBusy(key);
    setStatus("");
    try {
      const { data } = await apiClient.delete(
        `/api/social/rooms/${room.code}`,
        { headers }
      );
      if (!data?.success) throw new Error(data?.message || "Could not delete room");
      clearActiveLiveRoomSession(room.code);
      invalidateSocial("room-deleted", { code: room.code });
      setStatus(`Deleted ${room.name || room.code}.`);
    } catch (error) {
      setStatus(error?.response?.data?.message || error.message || "Could not delete room.");
    } finally {
      setRoomActionBusy("");
    }
  };

  return (
    <div className="sw-social-page sw20-page container-fluid px-0">
      <SocialPageHero
        kicker="Pass the Aux"
        title="A room that changes the moment someone taps."
        description="Friends add real songs, vote the queue and follow the same room state. Queue changes and host advances now update connected listeners live instead of waiting for a refresh."
        image={SOCIAL_IMAGES.rooms}
        live={realtimeConnected}
      />

      <div className="row g-3 g-xl-4">
        <div className="col-12 col-xl-8">
          <section className="sw-social-panel sw20-panel">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Your rooms</span><h2>Jump back in</h2></div><RadioTower size={20} /></div>
            <div className="sw20-room-grid">
              {(home?.rooms || []).map((room) => {
                const viewerId = String(home?.me?._id || "");
                const hostId = String(room?.host?._id || room?.host || "");
                const isMine = Boolean(viewerId && hostId === viewerId);
                const actionKey = `${isMine ? "delete" : "leave"}:${room.code}`;

                return (
                  <article className="sw20-room-card sw2322-room-card" key={room._id}>
                    <button
                      type="button"
                      className="sw2322-room-card-main"
                      onClick={() => navigate(`/social/rooms/${room.code}`)}
                    >
                      <span className="sw20-room-icon"><Headphones size={20} /></span>
                      <span>
                        <strong>{room.name}</strong>
                        <small>{room.code}</small>
                        <em><UsersRound size={13} /> {room.members?.length || 1} listeners</em>
                      </span>
                      <ArrowRight size={17} />
                    </button>

                    <button
                      type="button"
                      className={`sw2322-room-card-action ${isMine ? "delete" : ""}`}
                      onClick={(event) => isMine ? deleteRoom(event, room) : leaveRoom(event, room)}
                      disabled={roomActionBusy === actionKey}
                      aria-label={isMine ? `Delete ${room.name}` : `Leave ${room.name}`}
                      title={isMine ? "Delete room" : "Leave room"}
                    >
                      {isMine ? <Trash2 size={15} /> : <LogOut size={15} />}
                    </button>
                  </article>
                );
              })}
              {!home?.rooms?.length ? <div className="sw20-empty-card"><Headphones size={25} /><strong>No live rooms yet.</strong><p>Start one and send the room code to friends.</p></div> : null}
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-4">
          <section className="sw-social-panel sw20-panel">
            <div className="sw20-form-title"><RadioTower size={18} /><div><strong>Start a room</strong><small>Host a lightweight shared queue.</small></div></div>
            <div className="sw20-stack-form">
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Room name" />
              <button type="button" className="sw-primary-btn" onClick={create} disabled={busy === "create"}>{busy === "create" ? "Starting…" : "Start room"}</button>
            </div>
          </section>

          <section className="sw-social-panel sw20-panel mt-3">
            <div className="sw20-form-title"><Headphones size={18} /><div><strong>Join by code</strong><small>Room codes are quick to type and share.</small></div></div>
            <form className="sw20-inline-code" onSubmit={join}>
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Room code" />
              <button type="submit" className="sw-secondary-btn" disabled={busy === "join"}>Join</button>
            </form>
          </section>
        </div>
      </div>
      {status ? <div className="sw-social-message mt-3">{status}</div> : null}
    </div>
  );
};

export default SocialRooms;
