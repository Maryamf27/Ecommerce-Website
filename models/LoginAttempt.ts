import mongoose, { Schema, type Model } from "mongoose";

export type LoginAttemptDocument = {
  key: string;
  count: number;
  expiresAt: Date;
};

const loginAttemptSchema = new Schema<LoginAttemptDocument>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LoginAttempt = (mongoose.models.LoginAttempt as Model<LoginAttemptDocument> | undefined)
  ?? mongoose.model<LoginAttemptDocument>("LoginAttempt", loginAttemptSchema);

export default LoginAttempt;
