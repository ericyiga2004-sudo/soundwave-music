import jwt from "jsonwebtoken";

const getRequestToken = (req) => {
  const headerToken =
    req.headers.token || req.headers.authorization || req.headers.Authorization || "";
  return String(headerToken).replace(/^Bearer\s+/i, "").trim();
};

const optionalAuthUser = (req, _res, next) => {
  const token = getRequestToken(req);
  if (!token || !process.env.JWT_SECRET) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.id) req.userId = decoded.id;
  } catch {
    // Public routes stay public when an optional token is invalid/expired.
  }

  next();
};

export default optionalAuthUser;
