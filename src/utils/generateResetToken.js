const crypto = require("crypto");

const generateResetToken = () => {
  // raw token (send to user)
  const resetToken = crypto.randomBytes(32).toString("hex");

  // hashed version (store in DB for security)
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  return {
    resetToken,   // send via email
    hashedToken,  // store in database
  };
};

module.exports = generateResetToken;