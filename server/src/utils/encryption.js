const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended IV length

/**
 * Gets a stable 32-byte encryption key derived from process.env.ENCRYPTION_KEY.
 * Falls back to a default key if not provided (with console warnings).
 */
const getEncryptionKey = () => {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    console.warn(
      "WARNING: ENCRYPTION_KEY is not set. A fallback key is being used. This is unsafe for production environments."
    );
    return crypto.createHash("sha256").update("fallback_secret_key_change_me").digest();
  }
  // Use SHA-256 to derive a standard 32-byte (256-bit) key from the raw string
  return crypto.createHash("sha256").update(rawKey).digest();
};

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Encrypts a plaintext string to a ciphertext string in format: ivHex:tagHex:cipherHex.
 * @param {string} text - The plaintext to encrypt.
 * @returns {string} The encrypted string.
 */
const encrypt = (text) => {
  if (text === null || text === undefined) return text;
  
  const stringVal = typeof text === "string" ? text : String(text);
  if (stringVal.trim() === "") return stringVal;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(stringVal, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const tag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
};

/**
 * Decrypts a ciphertext string in format: ivHex:tagHex:cipherHex back to plaintext.
 * Handles non-encrypted/legacy strings gracefully.
 * @param {string} encryptedText - The encrypted string.
 * @returns {string} The decrypted plaintext.
 */
const decrypt = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== "string") return encryptedText;

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    // If not in "iv:tag:cipher" format, return as is (could be legacy/unencrypted data)
    return encryptedText;
  }

  try {
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error.message);
    return encryptedText;
  }
};

/**
 * Encrypts an array of strings.
 * @param {string[]} arr - Array of plaintext strings.
 * @returns {string[]} Encrypted array.
 */
const encryptArray = (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map((item) => encrypt(item));
};

/**
 * Decrypts an array of strings.
 * @param {string[]} arr - Array of encrypted strings.
 * @returns {string[]} Decrypted array.
 */
const decryptArray = (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map((item) => decrypt(item));
};

/**
 * Encrypts specific fields inside the medicines array objects.
 * @param {object[]} medicines - Array of medicine objects.
 * @returns {object[]} Encrypted medicines.
 */
const encryptMedicines = (medicines) => {
  if (!Array.isArray(medicines)) return medicines;
  return medicines.map((med) => {
    // If it's a Mongoose document/subdocument, it might have toObject() or be a plain object
    const obj = typeof med.toObject === "function" ? med.toObject() : med;
    const encryptedMed = { ...obj };
    if (encryptedMed.name) encryptedMed.name = encrypt(encryptedMed.name);
    if (encryptedMed.dosage) encryptedMed.dosage = encrypt(encryptedMed.dosage);
    if (encryptedMed.frequency) encryptedMed.frequency = encrypt(encryptedMed.frequency);
    if (encryptedMed.duration) encryptedMed.duration = encrypt(encryptedMed.duration);
    return encryptedMed;
  });
};

/**
 * Decrypts specific fields inside the medicines array objects.
 * @param {object[]} medicines - Array of medicine objects.
 * @returns {object[]} Decrypted medicines.
 */
const decryptMedicines = (medicines) => {
  if (!Array.isArray(medicines)) return medicines;
  return medicines.map((med) => {
    if (med.name) med.name = decrypt(med.name);
    if (med.dosage) med.dosage = decrypt(med.dosage);
    if (med.frequency) med.frequency = decrypt(med.frequency);
    if (med.duration) med.duration = decrypt(med.duration);
    return med;
  });
};

module.exports = {
  encrypt,
  decrypt,
  encryptArray,
  decryptArray,
  encryptMedicines,
  decryptMedicines,
};
