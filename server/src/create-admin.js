const mongoose = require("mongoose");
const User = require("./models/User");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/mediconnect");
    console.log("Connected to MongoDB");

    const email = "admin@mediconnect.com";
    const existing = await User.findOne({ email });

    if (existing) {
      console.log("Admin user already exists with email: " + email);
      process.exit(0);
    }

    const admin = new User({
      name: "System Admin",
      email,
      password: "Password123!",
      role: "Admin",
    });

    await admin.save();
    console.log("Admin user created successfully!");
    console.log("Email: admin@mediconnect.com");
    console.log("Password: Password123!");
    process.exit(0);
  } catch (error) {
    console.error("Error creating Admin user:", error);
    process.exit(1);
  }
};

seedAdmin();
