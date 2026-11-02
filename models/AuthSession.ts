import mongoose, { Schema, type Model, type Types } from "mongoose";

export type AuthSessionDocument = {
  tokenHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  tokenType: "access" | "refresh";
  createdAt: Date;
};

const authSessionSchema = new Schema<AuthSessionDocument>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },
    tokenType: { type: String, enum: ["access", "refresh"], required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthSession = (mongoose.models.AuthSession as Model<AuthSessionDocument> | undefined)
  ?? mongoose.model<AuthSessionDocument>("AuthSession", authSessionSchema);

export default AuthSession;
