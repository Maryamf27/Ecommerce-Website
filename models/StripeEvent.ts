import mongoose, { Schema, type Model } from "mongoose";

type StripeEventDocument = { eventId: string; type: string; createdAt: Date };
const stripeEventSchema = new Schema<StripeEventDocument>({
  eventId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

const StripeEvent = (mongoose.models.StripeEvent as Model<StripeEventDocument> | undefined)
  ?? mongoose.model<StripeEventDocument>("StripeEvent", stripeEventSchema);
export default StripeEvent;
