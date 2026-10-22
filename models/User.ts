import mongoose, { Schema, type Model } from "mongoose";

export type UserRole = "customer" | "admin";

export type SavedAddress = {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};

export type UserDocument = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  savedAddress?: SavedAddress;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin"], required: true, default: "customer" },
    savedAddress: {
      type: new Schema<SavedAddress>({
        name: { type: String, required: true, trim: true, maxlength: 80 },
        address: { type: String, required: true, trim: true, maxlength: 180 },
        city: { type: String, required: true, trim: true, maxlength: 100 },
        postalCode: { type: String, required: true, trim: true, maxlength: 20 },
        country: { type: String, required: true, trim: true, maxlength: 80 },
      }, { _id: false }),
      required: false,
    },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });

const User = (mongoose.models.User as Model<UserDocument> | undefined)
  ?? mongoose.model<UserDocument>("User", userSchema);

export default User;
