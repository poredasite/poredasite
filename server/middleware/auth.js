const adminAuth = (req, res, next) => {
  const password = req.headers["x-admin-password"] || req.body.adminPassword;

  if (!password) {
    return res.status(401).json({
      success: false,
      message: "Admin password required",
    });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({
      success: false,
      message: "Invalid admin password",
    });
  }

  next();
};

module.exports = { adminAuth };
