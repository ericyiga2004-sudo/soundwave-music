import jwt from "jsonwebtoken";

const isBadTokenValue = (value) => {
  if (!value) return true;

  const cleanValue = String(value).trim().toLowerCase();

  return (
    cleanValue === "" ||
    cleanValue === "false" ||
    cleanValue === "null" ||
    cleanValue === "undefined" ||
    cleanValue === "none" ||
    cleanValue === "nan"
  );
};

const getRequestToken = (req) => {
  const headerToken =
    req.headers.token ||
    req.headers.authorization ||
    req.headers.Authorization ||
    "";

  return String(headerToken).replace(/^Bearer\s+/i, "").trim();
};

const authUser = async (req, res, next) => {
  try {
    const token = getRequestToken(req);

    if (isBadTokenValue(token)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    req.userId = decoded.id;

    next();
  } catch (error) {
    console.log("Auth middleware error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export default authUser;