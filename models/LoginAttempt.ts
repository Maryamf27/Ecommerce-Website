import mongoose, { Schema, type Model } from "mongoose";

export type LoginAttemptDocument = {
  key: string;
  count: number;
  expiresAt: Date;
  lockoutUntil?: Date;
  lockoutCount?: number;
  lockoutResetAt?: Date;
  _failureCount?: number;
  _escalationCount?: number;
  _alreadyLocked?: boolean;
};

const loginAttemptSchema = new Schema<LoginAttemptDocument>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
    lockoutUntil: { type: Date },
    lockoutCount: { type: Number, min: 0 },
    lockoutResetAt: { type: Date },
    _failureCount: { type: Number, select: false },
    _escalationCount: { type: Number, select: false },
    _alreadyLocked: { type: Boolean, select: false },
  },
  { versionKey: false },
);

loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LoginAttempt = (mongoose.models.LoginAttempt as Model<LoginAttemptDocument> | undefined)
  ?? mongoose.model<LoginAttemptDocument>("LoginAttempt", loginAttemptSchema);

export default LoginAttempt;
