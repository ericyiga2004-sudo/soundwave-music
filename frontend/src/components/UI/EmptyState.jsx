import { Music2, RefreshCw } from "lucide-react";
import "./EmptyState.css";

const EmptyState = ({ title = "Nothing here yet", message = "Try again in a moment.", onRetry }) => (
  <div className="sw-empty-state" role="status">
    <span className="sw-empty-icon"><Music2 size={22} /></span>
    <div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
    {onRetry ? (
      <button type="button" onClick={onRetry}><RefreshCw size={15} /> Retry</button>
    ) : null}
  </div>
);

export default EmptyState;
