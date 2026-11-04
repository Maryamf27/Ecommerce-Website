import { Types } from "mongoose";
import ProductTag from "@/models/ProductTag";
import Tag from "@/models/Tag";

export const tagRepository = {
  list() {
    return Tag.find().sort({ name: 1 }).lean<Array<{ _id: Types.ObjectId; name: string; slug: string }>>();
  },
  create(name: string, slug: string) {
    return Tag.create({ name, slug });
  },
  update(id: string, name: string, slug: string) {
    return Tag.findByIdAndUpdate(id, { $set: { name, slug } }, { new: true, runValidators: true })
      .lean<{ _id: Types.ObjectId; name: string; slug: string } | null>();
  },
  async deleteIfUnused(id: string) {
    if (await ProductTag.exists({ tagId: id })) return "in-use" as const;
    const result = await Tag.deleteOne({ _id: id });
    return result.deletedCount === 1 ? "deleted" as const : "not-found" as const;
  },
};
