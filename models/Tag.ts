import mongoose, { Schema, type Model } from "mongoose";

export type TagDocument = {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

const tagSchema = new Schema<TagDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      unique: true,
    },
  },
  { timestamps: true, versionKey: false },
);

const Tag =
  (mongoose.models.Tag as Model<TagDocument> | undefined) ??
  mongoose.model<TagDocument>("Tag", tagSchema);

export default Tag;