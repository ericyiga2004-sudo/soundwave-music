import { Link } from "react-router-dom";
import "./CSS/CatalogPages.css";
const NotFound=()=> <div className="sw-not-found"><span className="sw-catalog-eyebrow">404</span><h1>Lost in the mix.</h1><p>That SoundWave page does not exist.</p><div><Link className="sw-primary-btn" to="/">Back to Home</Link></div></div>;
export default NotFound;
