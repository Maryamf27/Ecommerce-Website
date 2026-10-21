import mongoose, { Schema, type Model } from "mongoose";

export type UserRole = "customer" | "admin";

export type UserDocument = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin"], required: true, default: "customer" },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });

const User = (mongoose.models.User as Model<UserDocument> | undefined)
  ?? mongoose.model<UserDocument>("User", userSchema);

export default User;
