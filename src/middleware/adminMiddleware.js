const adminOnly = (req, res, next) => {
  try {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    // Ensure role exists in token
    if (!req.user.role) {
      return res.status(403).json({
        message: "Role not found in token",
      });
    }

    // Check admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);

    return res.status(500).json({
      message: "Authorization error",
    });
  }
};

module.exports = adminOnly;