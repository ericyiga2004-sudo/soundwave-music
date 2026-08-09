import crypto from "crypto";

const getSuppliedKey = (req) => {
  const authorization = String(req.headers.authorization || "").trim();

  if (/^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, "").trim();
  }

  return String(req.headers["x-orbit-connector-key"] || "").trim();
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const orbitConnectorAuth = (req, res, next) => {
  const expectedKey = String(process.env.ORBIT_CONNECTOR_KEY || "").trim();

  if (!expectedKey) {
    console.error("Orbit connector rejected: ORBIT_CONNECTOR_KEY is not configured");

    return res.status(503).json({
      success: false,
      message: "Orbit connector is not configured",
    });
  }

  const suppliedKey = getSuppliedKey(req);

  if (!suppliedKey || !safeEqual(suppliedKey, expectedKey)) {
    return res.status(401).json({
      success: false,
      message: "Invalid Orbit connector credentials",
    });
  }

  next();
};

export default orbitConnectorAuth;
