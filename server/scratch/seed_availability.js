const mongoose = require("mongoose");
require("dotenv").config();

const Doctor = require("../src/models/Doctor");
const DoctorAvailability = require("../src/models/DoctorAvailability");
const User = require("../src/models/User");

const seedAvailability = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/mediconnect";
    console.log("Connecting to MongoDB at:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("Connected successfully!");

    // Find all doctors
    const doctors = await Doctor.find().populate("user");
    console.log(`Found ${doctors.length} doctors in the database.`);

    for (const doc of doctors) {
      if (!doc.user) {
        console.log(`Doctor profile ID ${doc._id} has no linked user account. Skipping.`);
        continue;
      }
      
      const doctorId = doc.user._id;
      const docName = doc.user.name;

      // Check if availability already exists
      const existing = await DoctorAvailability.findOne({ doctorId });
      if (existing) {
        console.log(`Doctor ${docName} (ID: ${doctorId}) already has availability configured.`);
        continue;
      }

      // Create default availability
      const availability = new DoctorAvailability({
        doctorId,
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], // Set 7 days for ease of testing
        startHour: "09:00",
        endHour: "17:00",
        slotDuration: 30,
        breakSlots: [
          {
            start: "12:00",
            end: "13:00"
          }
        ]
      });

      await availability.save();
      console.log(`Created default availability for Dr. ${docName}`);
    }

    console.log("Availability seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding availability:", error);
    process.exit(1);
  }
};

seedAvailability();
