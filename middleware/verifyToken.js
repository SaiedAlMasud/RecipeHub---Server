const {jwtVerify, createRemoteJWKSet } = require("jose");

const JWKS = createRemoteJWKSet(new URL(process.env.BETTER_AUTH_URL + "/api/auth/jwks"));

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      JWKS
    );

    req.user = payload;

    next();
  } catch (error) {
    console.error(error);

    return res.status(403).json({
      message: "Forbidden",
    });
  }
};

module.exports = verifyToken;